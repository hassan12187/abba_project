import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import { checkToken, getAccessToken, getRefreshedToken } from "./jwtService.js";

export const Login=async(req,res)=>{
    try {
    const {email,password}=req.body;
    const userData=await userModel.findOne({email});
    if(!userData)return res.status(401).send("Invalid Credentials.");
    const isMatched=await bcrypt.compare(password,userData.password);
    if(!isMatched)return res.status(401).send("Invalid Credentials.");
    const accessToken=getAccessToken(userData);
    const refreshedToken=getRefreshedToken(userData._id);
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
        if(token == "" || token==null || token==undefined)return res.sendStatus(403);
        const parsedToken=token.split("Bearer ")[1];
        const userData=checkToken(parsedToken);
        if(userData.role=="ADMIN") {
            req.id=userData.id;
            return next();
        };
        return res.sendStatus(403);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const isAuthorizedStudentOrAdmin=async(req,res,next)=>{
    try {
        const token = req.headers?.authorization;
        if(token =="" || token==null || token==undefined)return res.sendStatus(403);
        const parsedToken=token.split("Bearer ")[1];
        const tokenPayload=checkToken(parsedToken);
        if(tokenPayload.role == "STUDENT" || tokenPayload.role=="ADMIN"){
            req.id=tokenPayload.id;
            return next();
        };
        return res.sendStatus(403);
    } catch (error) {
        return res.sendStatus(500);
    }
}
export const verifyCsrf=async(req,res,next)=>{
    const cookieToken=req.cookies.csrfToken;
    const headerToken=req.headers['x-csrf-token'];
    if(!cookieToken || !headerToken || cookieToken !== headerToken){
        return res.status(403).json({message:"Invalid CSRF Token"});
    };
    next();
}