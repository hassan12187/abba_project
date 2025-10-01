import { Router } from "express";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import { getAccessToken, getRefreshedToken } from "../services/jwtService.js";
const routes=Router();
routes.post('/refresh-token',async(req,res)=>{
    const refreshToken=req.cookies.refreshToken;
    if(!refreshToken)return res.sendStatus(401);
    try {
        const payload=jwt.verify(refreshToken,process.env.REFRESH_TOKEN_SECRET);
        const user = await userModel.findById(payload.id);
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
        return res.json({accessToken:newAccessToken});
    } catch (error) {
        return res.sendStatus(503);
    }
});
export default routes;