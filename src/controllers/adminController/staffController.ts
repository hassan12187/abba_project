import { type Request,type Response } from "express";
import MaintenanceStaff from "../../models/MaintenanceStaff.js";

interface GetStaffQuery{
    page:string,
    limit:string
};

export const getStaffs=async(req:Request<{},{},{},GetStaffQuery>,res:Response)=>{
    try {
        const {page,limit}=req.query;
        const staffs = await MaintenanceStaff.find().skip(parseInt(limit)*parseInt(page)).limit(parseInt(limit));
        return res.status(200).send(staffs);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const addStaff=async(req:Request,res:Response)=>{
    try {
        const {name,department,contact,availability_status}=req.body;
        const isExist=await MaintenanceStaff.findOne({contact});
        if(isExist)return res.sendStatus(409);
        const user = await MaintenanceStaff.create({name,department,contact,availability_status});
        if(!user)return res.sendStatus(403);
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);        
    }
};
export const getStaff=async(req:Request,res:Response)=>{
    try {
        const {id}=req.params;
        const staff = await MaintenanceStaff.findOne({_id:id});
        if(!staff)return res.sendStatus(204);
        return res.status(200).send({id:staff._id,name:staff.name,department:staff.department,contact:staff.contact,status:staff.status});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const editStaff=async(req:Request,res:Response)=>{
        try {
        const {id}=req.params;
        const staff=await MaintenanceStaff.findOneAndUpdate({_id:id},{$set:req.body});
        if(!staff)return res.sendStatus(403);
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
};