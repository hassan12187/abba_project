import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../..//services/Redis.js";


// Student Get Details
export const getStudentDetails=async(req,res)=>{
    try {
        const id = req.id;
        const student=await studentApplicationModel.findOne({_id:id}).populate({
            path:"room_id",
            select:"room_no"
        });
        if(!student)return res.status(404).json({message:"No Student Found."});
        const dataModel={
            id:student._id,
            name:student.student_name,
            room:student.room_id,
        };
        return res.status(200).json({data:dataModel});
    } catch (error) {
        console.log("inside student ",error);
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