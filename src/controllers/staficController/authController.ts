import userModel from "../../modules/user/userModel.js";
import { getAccessToken, getRefreshedToken } from "../../services/jwtService.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type {Response,Request} from "express";

interface ExtraJWT extends JwtPayload{
    id?:any
}
export const handleRefreshToken=async(req:Request,res:Response)=>{
    const refreshToken=req.cookies.refreshToken;
    if(!refreshToken)return res.sendStatus(401);
    try {
        const refreshSecret=process.env.ACCESS_TOKEN_SECRET;
        if(!refreshSecret){
            return res.sendStatus(500);
        };
        const payload=jwt.verify(refreshToken,refreshSecret) as ExtraJWT;
        if(!payload || !payload.id)return res.sendStatus(404);
        const user= await userModel.findById(payload.id);
        if(!user || user.refreshToken!==refreshToken)return res.sendStatus(403);
        const newAccessToken=getAccessToken(user);
        const newRefreshToken=getRefreshedToken(user);
        user.refreshToken=newRefreshToken;
        await user.save();
        res.cookie("refreshToken",newRefreshToken,{
            httpOnly:true,
            secure:true,
            sameSite:'strict',
            maxAge:7*24*60*60*1000,
        });
        console.log("in refreshed route");
        return res.json({accessToken:newAccessToken});
    } catch (error) {
        console.log(error);
        return res.sendStatus(503);
    }
};
export const handleLogout=async(req:Request,res:Response)=>{
    const refreshToken=req.cookies?.refreshToken;
    if(!refreshToken)return res.sendStatus(204);
    try {
        const refreshSecret=process.env.ACCESS_TOKEN_SECRET;
        if(!refreshSecret){
            return res.sendStatus(500);
        }
        const payload = jwt.verify(refreshToken,refreshSecret) as ExtraJWT;
        if(!payload || !payload.id)return res.sendStatus(404);         
        const user = await userModel.findById(payload.id);
        if(user){
            user.refreshToken=null;
            await user.save();
        };
        res.clearCookie("refreshToken",{
            httpOnly:true,
            secure:true,
            sameSite:'strict',
        });
        return res.sendStatus(204);
    } catch (error) {
        return res.sendStatus(503);
    }
};