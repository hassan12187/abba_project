import MaintenanceStaff from "../models/MaintenanceStaff.js";

export const getStaffs=async(req,res)=>{
    try {
        const {page,limit}=req.query;
        const staffs = await MaintenanceStaff.find().skip(limit*page).limit(limit);
        return res.status(200).send(staffs);
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const addStaff=async(req,res)=>{
    try {
        const {name,department,contact,availability_status}=req.body;
        const isExist=await MaintenanceStaff.findOne({contact});
        console.log(isExist);
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);        
    }
};