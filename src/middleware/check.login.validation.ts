import { userLoginValidationSchema } from "../services/user.login.validation.js";
import type {Request,Response,NextFunction} from "express";

export const checkLoginValidationMiddleware=async(req:Request,res:Response,next:NextFunction)=>{
    try {
        const {error,value,warning}=userLoginValidationSchema.validate(req.body,{abortEarly:false});
        if(error)return res.send({status:400,data:error.message});
        next();
    } catch (error) {
        console.log(error);
    }
}