import { userLoginValidationSchema } from "../services/user.login.validation.js";

export const checkLoginValidationMiddleware=async(req,res,next)=>{
    try {
        const {error,value,warning}=userLoginValidationSchema.validate(req.body,{abortEarly:false});
        if(error)return res.send({status:400,data:error.message});
        next();
    } catch (error) {
        console.log(error);
    }
}