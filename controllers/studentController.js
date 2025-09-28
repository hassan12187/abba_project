import studentApplicationModel from "../models/studentApplicationModel.js";

export const RegisterApplication=async(req,res)=>{
    try {
        const {student_name,student_email,father_name,guardian_name,guardian_cellphone,student_cellphone,father_cellphone,city,province,date_of_birth,academic_year,active_whatsapp_no,cnic_no,postal_address,permanent_address,student_roll_no,gender}=req.body;
        const student=await studentApplicationModel.find({student_roll_no});
        if(student.length>=1)return res.send({status:402,data:"You have already applied for the hostel."});
        const result = await studentApplicationModel.create({student_name,student_email,student_roll_no,father_name,father_cellphone,guardian_name,guardian_cellphone,city,province,date_of_birth,academic_year,active_whatsapp_no,postal_address,permanent_address,student_cellphone,cnic_no,gender,application_submit_date:new Date().toLocaleDateString()});
        result.save();
        return res.send({status:200,data:"Form submitted successfully."});
    } catch (error) {
        return res.send({status:500,data:"Oops! A server error occurred."});
    }
};