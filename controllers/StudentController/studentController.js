import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../..//services/Redis.js";


// Student Get Details
export const getStudentDetails=async(req,res)=>{
    console.log("im inside student details");
    try {
        const id = req.id;
        const student=await studentApplicationModel.findOne({_id:id}).populate("room_id");
        const dataModel={
            id:student._id,
            name:student.student_name,
            room:student.room_id,
        };
        return res.status(200).json({data:dataModel});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getRoomMates=async(req,res)=>{
    try {
        const id = req.id;
    } catch (error) {
        return res.sendStatus(500);
    }
};