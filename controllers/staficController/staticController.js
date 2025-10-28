import userModel from "../../models/userModel.js";
import bcrypt from "bcrypt";
// import { changePasswordVerification } from "../services/emailJobs.js";
import jwt from "jsonwebtoken";

export const handleRequestPasswordChange=async(req,res)=>{
    try {
        const {email}=req.body;
        const user=await userModel.findOne({email});
        if(!user)return res.status(400).send("If this email exists, a code has been sent");
        const code=Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const hashedCode=await bcrypt.hash(code,salt);
        user.passwordResetCode=hashedCode;
        user.passwordResetExpires=Date.now()+5*60*1000;
        await user.save();
        // await changePasswordVerification(email,code);
        return res.status(200).send("Verification Code send to Your Email");
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const verifyCode=async(req,res)=>{
    const {email,code}=req.body;
    if(!email)return res.sendStatus(204);
    const user = await userModel.findOne({email});
    if(!user)return res.sendStatus(403);
    const isMatched = await bcrypt.compare(code,user.passwordResetCode);
    if(!isMatched || user.passwordResetExpires < Date.now())return res.sendStatus(403);
    const token = jwt.sign({id:user._id,email},process.env.TEMP_PASS_TOKEN,{
        expiresIn:'5m'
    });
    user.passwordResetCode=null;
    await user.save();
    return res.status(200).json({token});
};
export const ChangePassword=async(req,res)=>{
    const {password,token}=req.body;
    try {
        const decoded = jwt.verify(token,process.env.TEMP_PASS_TOKEN);
        const user = await userModel.findOne({_id:decoded.id});
        if(!user)return res.sendStatus(401);
        user.password=password;
        user.passwordResetExpires=null;
        await user.save();
        return res.status(200).send("Password Changed Successfully.");
    } catch (error) {
        return res.sendStatus(500);
    }
}