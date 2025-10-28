import userModel from "../../models/userModel.js";
import { changePasswordVerification } from "../services/emailJobs.js";
import redis from "../services/Redis.js";
import bcrypt from "bcrypt";

export const getProfileInformation=async(req,res)=>{
    try {
        const id = req.id;
        const cachedData=await redis.get(`details:${id}`);
        let parsedData=JSON.parse(cachedData);
        if(cachedData)return res.status(200).json({data:{email:parsedData?.email,username:parsedData?.username,id:parsedData?._id,phone:parsedData?.phone}});
        const user=await userModel.findOne({_id:id});
        console.log(user);
        if(!user)return res.sendStatus(204);
        await redis.setex(`details:${id}`,3600,JSON.stringify(user));
        return res.status(200).json({data:{email:user.email,username:user.username,id:user._id,phone:user?.phone}});
    } catch (error) {
        return res.sendStatus(500);
    }
}
export const handleUpdateProfileInformation=async(req,res)=>{
    try {
        const {id}=req.params;
        const result = await userModel.findByIdAndUpdate({_id:id},{$set:req.body},{new:true});
        if(!result)return res.sendStatus(409);
        await redis.del(`details:${id}`);
        await redis.setex(`details:${id}`,3600,JSON.stringify(result));
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const requestPasswordChange =async(req,res)=>{
     try {
        const {id}=req.params;
        const {currentPassword,newPassword,confirmPassword}=req.body;
        if(newPassword != confirmPassword)return res.sendStatus(409);
        const userData=await userModel.findOne({_id:id});
        const isTrue =await bcrypt.compare(currentPassword,userData.password);
        if(!isTrue)return res.status(401).json("Invalid Password");
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode=await bcrypt.hash(code,10);
        userData.passwordResetCode=hashedCode;
        userData.passwordResetExpires=Date.now() + 5 * 60 * 1000;
        await userData.save();
        await changePasswordVerification(userData.email,code);
        return res.status(200).json({message:"Verification code sent to your email"});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const changePassword=async(req,res)=>{
    try {
        const {id}=req.params;
        const {code}=req.body;
        const user = await userModel.findOne({_id:id});
        if(!user)return res.sendStatus(401);
        const isValid=await bcrypt.compare(code,user.passwordResetCode);
        if(!isValid || user.passwordResetExpires<Date.now()){
            return res.status(400).json({message:"Invalid or Expired Code."});
        };
        
    } catch (error) {
        return res.sendStatus(500);
    }
};