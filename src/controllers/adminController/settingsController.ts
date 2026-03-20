import userModel from "../../modules/user/userModel.js";
import { changePasswordVerification } from "../../services/emailJobs.js";
import redis from "../../services/Redis.js";
import bcrypt from "bcrypt";
import type {Request,Response} from "express";

interface AuthenticationRequest extends Request{
    id?:string
}

export const getProfileInformation=async(req:AuthenticationRequest,res:Response)=>{
    try {
        const id = req.id;
        const cachedData=await redis.get(`details:${id}`);
        if(cachedData)
            {
        let parsedData=JSON.parse(cachedData);
                return res.status(200).json({data:{email:parsedData?.email,username:parsedData?.username,id:parsedData?._id,phone:parsedData?.phone}})
    };
        const user=await userModel.findOne({_id:id});
        console.log(user);
        if(!user)return res.sendStatus(204);
        await redis.setex(`details:${id}`,3600,JSON.stringify(user));
        return res.status(200).json({data:{email:user.email,username:user.username,id:user._id,phone:user?.phone}});
    } catch (error) {
        return res.sendStatus(500);
    }
}
export const handleUpdateProfileInformation=async(req:Request,res:Response)=>{
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
export const requestPasswordChange =async(req:Request,res:Response)=>{
     try {
        const {id}=req.params;
        const {currentPassword,newPassword,confirmPassword}=req.body;
        if(newPassword != confirmPassword)return res.sendStatus(409);
        const userData=await userModel.findOne({_id:id});
        if(!userData)return res.status(404).json({message:"User not found."});
        const isTrue =await bcrypt.compare(currentPassword,userData.password);
        if(!isTrue)return res.status(401).json("Invalid Password");
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode=await bcrypt.hash(code,10);
        userData.passwordResetCode=hashedCode;
        userData.passwordResetExpires=new Date(Date.now() + 5 * 60 * 1000);
        await userData.save();
        await changePasswordVerification(userData.email,code);
        return res.status(200).json({message:"Verification code sent to your email"});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const changePassword = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { code, newPassword } = req.body; // Added newPassword to the destructuring

        // 1. Basic validation
        if (!code || !newPassword) {
            return res.status(400).json({ message: "Code and new password are required." });
        }

        const user = await userModel.findById(id);
        if (!user) return res.sendStatus(404);

        // 2. Type Guard: Ensure reset fields exist before using them
        if (!user.passwordResetCode || !user.passwordResetExpires) {
            return res.status(400).json({ message: "No password reset requested for this user." });
        }

        // 3. Verify Code
        const isValid = await bcrypt.compare(code, user.passwordResetCode);
        
        // 4. Check Expiration (ensure comparison uses Date objects or timestamps correctly)
        const isExpired = new Date(user.passwordResetExpires).getTime() < Date.now();

        if (!isValid || isExpired) {
            return res.status(400).json({ message: "Invalid or Expired Code." });
        }

        // 5. Hash New Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 6. Update User & Clear Reset Fields
        user.password = hashedPassword;
        user.passwordResetCode= null; // Clear the code so it can't be reused
        user.passwordResetExpires = null; // Clear the expiry
        
        await user.save();

        return res.status(200).json({ message: "Password updated successfully." });

    } catch (error) {
        console.error("Change Password Error:", error);
        return res.sendStatus(500);
    }
};