import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import { checkToken, getAccessToken, getRefreshedToken } from "./jwtService.js";
import type {Response,Request, NextFunction} from "express";

interface AuthenticationRequest extends Request{
    id?:string
};

export const Login=async(req:Request,res:Response)=>{
    try {
    // const {email,password}=req.body;
    const email:string=req.body.email;
    const password:string=req.body.password;
    const userData=await userModel.findOne({email});
    if(!userData)return res.status(403).send("Invalid Credentials.");
    const isMatched=await bcrypt.compare(password,userData.password);
    if(!isMatched)return res.status(401).send("Invalid Credentials.");
    const accessToken=getAccessToken(userData);
    const refreshedToken=getRefreshedToken(userData);
    userData.refreshToken=refreshedToken;
    await userData.save();
    res.cookie("refreshToken",refreshedToken,{
            httpOnly:true,
            secure:true,
            sameSite:'strict',
            maxAge:7*24*60*60*1000,
        });
        return res.status(200).json({data:"Login Successfull.",token:accessToken,role:userData.role});
    } catch (error) {
        console.log(error);
        return res.status(500).json({data:"Oops! A server error occurred."});
    }
};
// export const Register=async(req:Request,res:Response)=>{
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
export const isAuthorized=async(req:AuthenticationRequest,res:Response,next:NextFunction)=>{
    try {
        const token=req.headers?.authorization;
        if(token == "" || token==null || token==undefined)return res.sendStatus(403);
        const parsedToken=token.split("Bearer ")[1];
        if(!parsedToken)return res.status(404).json({message:"Token not found."});
        const userData=checkToken(parsedToken);
        if(!userData)return res.status(404).json({message:"No user found."});
        if(userData.role=="ADMIN") {
            req.id=userData.id;
            return next();
        };
        return res.sendStatus(403);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const isAuthorizedStudent=async(req:AuthenticationRequest,res:Response,next:NextFunction)=>{
    try {
        const token = req.headers?.authorization;
        if(token =="" || token==null || token==undefined)return res.sendStatus(404);
        const parsedToken=token.split("Bearer ")[1];
        if(!parsedToken)return res.status(404).json({message:"Token not found."});
        const tokenPayload=checkToken(parsedToken);
        if(!tokenPayload)return res.sendStatus(404);
        if(tokenPayload.role == "STUDENT"){
            req.id=tokenPayload.id;
            return next();
        };
        return res.status(400).json({message:"Not Authorized."});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message:"Internal Server Error."});
    }
}
export const verifyCsrf=async(req:Request,res:Response,next:NextFunction)=>{
    const cookieToken=req.cookies.csrfToken;
    const headerToken=req.headers['x-csrf-token'];
    if(!cookieToken || !headerToken || cookieToken !== headerToken){
        return res.status(403).json({message:"Invalid CSRF Token"});
    };
    next();
}