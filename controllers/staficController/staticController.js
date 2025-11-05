import userModel from "../../models/userModel.js";
import bcrypt from "bcrypt";
import { changePasswordVerification } from "../../services/emailJobs.js";
import jwt from "jsonwebtoken";
import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../../services/Redis.js";
import { io } from "../../index.js";
import NotificationModel from "../../models/notificationModel.js";

export const RegisterApplication=async(req,res)=>{
    console.log("han bhaijaan kia haal hai");
    try {
        const {student_name,student_email,father_name,guardian_name,guardian_cellphone,student_cellphone,father_cellphone,city,province,date_of_birth,academic_year,active_whatsapp_no,cnic_no,postal_address,permanent_address,student_roll_no,gender}=req.body;
        const student=await studentApplicationModel.find({student_roll_no});
        if(student.length>=1)return res.status(400).json({data:"You have already applied for the hostel."});
        const result = await studentApplicationModel.create({student_name,student_email,student_roll_no,father_name,father_cellphone,guardian_name,guardian_cellphone,city,province,date_of_birth,academic_year,active_whatsapp_no,postal_address,permanent_address,student_cellphone,cnic_no,gender,application_submit_date:new Date().toLocaleDateString()});
        const isSubmitted = await result.save();
        if(!isSubmitted)return res.status(400).json({data:"Error Submitting Application"});
        await NotificationModel.create({
            message:`New hostel application from ${result.student_name} (${result.student_roll_no}, ${result.academic_year})`,
            application_id:result._id
        });
        let cursor = "0";
        do{
            const reply=await redis.scan(cursor,'MATCH','applications*','COUNT',100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length >0){
                await redis.del(...keys);
            }
        }while(cursor !== "0");
        io.emit("newApplication",{
            message:`New hostel application from ${result.student_name} (${result.department}, ${result.academic_year})`,
            application_id:result._id
        });
        return res.status(200).json({data:"Form submitted successfully."});
    } catch (error) {
        return res.status(500).json({data:"Oops! A server error occurred."});
    }
};

export const handleRequestPasswordChange=async(req,res)=>{
    try {
        const {email}=req.body;
        const user=await userModel.findOne({email});
        console.log(user);
        if(!user)return res.status(400).send("If this email exists, a code has been sent");
        const code=Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const hashedCode=await bcrypt.hash(code,salt);
        user.passwordResetCode=hashedCode;
        user.passwordResetExpires=Date.now()+5*60*1000;
        await user.save();
        await changePasswordVerification(email,code);
        return res.status(200).send("Verification Code send to Your Email");
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const verifyCode=async(req,res)=>{
    const {email,code}=req.body;
    try {
         if(!email)return res.sendStatus(404);
    const user = await userModel.findOne({email});
    if(!user)return res.sendStatus(404);
    const isMatched = await bcrypt.compare(code,user.passwordResetCode);
    if(!isMatched || user.passwordResetExpires < Date.now())return res.sendStatus(403);
    const token = jwt.sign({id:user._id,email},process.env.TEMP_PASS_TOKEN,{
        expiresIn:'5m'
    });
    user.passwordResetCode=null;
    await user.save();
    return res.status(200).json({token});
    } catch (error) {
        return res.sendStatus(500);
    }
   
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