import { io } from "../../index.js";
import NotificationModel from "../../models/notificationModel.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";
// import redis from "../services/Redis.js";

export const RegisterApplication=async(req,res)=>{
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
        // let cursor = "0";
        // do{
        //     const reply=await redis.scan(cursor,'MATCH','applications*','COUNT',100);
        //     cursor=reply[0];
        //     const keys = reply[1];
        //     if(keys.length >0){
        //         await redis.del(...keys);
        //     }
        // }while(cursor !== "0");
        io.emit("newApplication",{
            message:`New hostel application from ${result.student_name} (${result.department}, ${result.academic_year})`,
            application_id:result._id
        });
        return res.status(200).json({data:"Form submitted successfully."});
    } catch (error) {
        return res.status(500).json({data:"Oops! A server error occurred."});
    }
};