import { startSession } from "mongoose";
import ComplainModel from "../../models/complaintModel.js";
import MaintenanceModel from "../../models/Maintenance.js";

export const getAllComplaints=async(req,res)=>{
    try {
        const {page,limit,room_no="",category="",status=""}=req.query;
        let filterKey={};
        // let rooms;
        // if(room_no){
        //     rooms=await roomModel.find({room_no:room_no});
        // };
        if(category)filterKey.category=category;
        if(status)filterKey.status=status;
        const complaints = await ComplainModel.find(filterKey).skip(page*limit).limit();
        if(complaints.length<=0)return res.sendStatus(204);
        return res.status(200).send(complaints);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getComplain=async(req,res)=>{
    try {
        const {id}=req.params;
        const complain = await ComplainModel.findOne({_id:id}).populate(["student_id","room_id"]);
        if(!complain)return res.sendStatus(204);
        return res.status(200).send(complain);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const addComplain=async(req,res)=>{
    try {
        const {title,description,category,room_id,student_id}=req.body;
        const complain = await ComplainModel.create({title,description,category,room_id,student_id});
        if(!complain)return res.sendStatus(204);
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const editComplain=async(req,res)=>{
    try {
        const {id}=req.params;
        const result = await ComplainModel.findOneAndUpdate({_id:id},{$set:req.body});
        if(!result)return res.sendStatus(403);
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const approveComplain=async(req,res)=>{
    const session = await startSession();
    session.startTransaction();
    try {
        const {id}=req.params;
            const complaint=await ComplainModel.findOne({_id:id}).session(session);
            if(!complaint){
                await session.abortTransaction();
                await session.endSession();
                return res.status(404).json({message:"Complaint Not Found."});
            }
            complaint.status="In Progress";
            await complaint.save({session});
            await MaintenanceModel.create({complain:complaint._id,room:complaint.room_id,issue_description:complaint.description},{session})
            await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        await session.endSession();
        return res.sendStatus(500);
    }
};