import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import { checkToken, getAccessToken, getRefreshedToken } from "./jwtService.js";

export const Login=async(req,res)=>{
    try {
        const {email,password}=req.body;
      const user = await userModel.findOne({email});
    if(!user)return res.send({status:401,data:"Email not Found."});
    const isMatched=await bcrypt.compare(password,user.password);
    if(!isMatched)return res.send({status:401,data:"Password not Matched."});
    const accessToken=getAccessToken({user});
    const refreshedToken=getRefreshedToken(user._id);
    user.refreshToken=refreshedToken;
    await user.save();
    res.cookie("refreshToken",refreshedToken,{
            httpOnly:true,
            secure:true,
            sameSite:'strict',
            maxAge:7*24*60*60*1000,
        });
        return res.send({status:200,data:"Login Successfull.",token:accessToken,role:user.role});
    } catch (error) {
        return res.send({status:500,data:"Oops! A server error occurred."});
    }
};
// export const Register=async(req,res)=>{
//     try {
//         const user=new userModel({
//             username:"Osama Baloch",
//             email:"admin@gmail.com",
//             password:"admin121",
//             role:"ADMIN"
//         });
//         const result=await user.save();
//         console.log(result);
//     } catch (error) {
//         return res.send({status:500,data:"Oops! A server error occurred."});
//     }
// };
export const isAuthorized=async(req,res,next)=>{
    try {
        const token=req.headers?.authorization;
        if(!token)return res.send({status:300,data:"Not Authorized."});
        const parsedToken=token.split("Bearer ")[1];
        const userData=checkToken(parsedToken);
        if(userData.role=="ADMIN") return next();
        return res.send({status:300,data:"Not Authorized."});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
};