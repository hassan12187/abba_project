import ComplainModel from "../models/complaintModel.js";

export const getAllComplaints=async(req,res)=>{
    try {
        const {page,limit}=req.query;
        const complaints = await ComplainModel.find().skip(page*limit).limit();
        if(complaints.length<=0)return res.sendStatus(204);
        return res.status(200).send(complaints);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getComplain=async(req,res)=>{
    try {
        const {id}=req.params;
        const complain = await ComplainModel.findOne({_id:id});
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