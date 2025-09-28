import roomModel from "../models/roomModel.js";
import studentApplicationModel from "../models/studentApplicationModel.js";

export const getStudent=async(req,res)=>{
    try {
        const {id}=req.params;
        const student = await studentApplicationModel.findOne({_id:id});
        if(student===null)return res.send({status:302,data:"No matching student record was found."});
        return res.send({status:200,data:student});
    } catch (error) {
        return res.send({status:500,data:"Oops! A server error occurred."});
    }
};
export const getStudentApplications=async(req,res)=>{
   try {
        const students = await studentApplicationModel.find({
            $or:[
                {status:"pending"},
                {status:"rejected"}
            ]
        });    
        if(students.length==0)return res.send({status:302,data:"No Student Applications"});
        return res.send({status:200,data:students});
    } catch (error) {
        return res.send({status:500,data:"Oops! A server error occurred."});
    }
};

export const getAllStudents=async(req,res)=>{
    try {
        const students = await studentApplicationModel.find({status:"approved"}).populate("room_id");
        if(students.length==0)return res.send({status:302,data:"No Student Applications"});
        return res.send({status:200,data:students});
    } catch (error) {
        return res.send({status:500,data:"Oops! A server error occurred."});
    }
};
export const editStudent=async(req,res)=>{
    try {
        const {id}=req.params;
        // const {first_name,last_name,status,application_status,cnic,cellphone,room_id,address,emergency_contact,registration_date}=req.body;
        const student = await studentApplicationModel.findOneAndUpdate({_id:id},{$set:req.body});
        return res.send({status:200,data:"Student Appication Status Updated."});
        // if(student===null)return res.send({status:400,data:"No Student Found."});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error"});
    }
};
// export const handleStudentStatus=async(req,res)=>{
//     try {
//         const {id}=req.params;
//         const {application_status}=req.body;
//         const student=await studentApplicationModel.findOneAndUpdate({_id:id},{$set:{}});        
//     } catch (error) {
//         return res.send({status:500,data:"Internal Server Error"});
//     }
// }
// export const handleStudentApplicationStatus=async(req,res)=>{
//     try {
//         const {id}=req.params;
//         const {status}=req.body;
//         const result = await studentApplicationModel.findOneAndUpdate({_id:id},{$set:{status}});
//         if(result)return res.send({status:200,data:"Student Application Updated"});
//         return res.send({status:402,data:"Student Application Not Updated"});
//     } catch (error) {
//         return res.send({status:500,data:"Internal Server Error."});
//     }
// }
export const addRoom=async(req,res)=>{
    try {
        const {room_no,total_beds,available_beds}=req.body;
        const room = await roomModel.findOne({room_no});
        if(room!=null)return res.send({status:400,data:"Room Already Added."});
        const result = await roomModel.insertOne({room_no,total_beds,available_beds});       
        return res.send({status:200,data:"Room Successfull Added.",result});
    } catch (error) {
    return res.send({status:500,data:"Internal Server Error"});
}
};
export const getRooms=async(req,res)=>{
    try {
        const rooms = await roomModel.find();
        if(rooms.length <=0)return res.send({status:400,data:"No Room Found"});
        return res.send({status:200,data:rooms});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error"});
    }
}