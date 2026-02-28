import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../..//services/Redis.js";
import mongoose from "mongoose";
import ComplainModel from "../../models/complaintModel.js";
import userModel from "../../models/userModel.js";
import bcrypt from "bcrypt";
import FeeInvoiceModel from "../../models/FeeInvoice.js";


// Student Get Details
export const getStudentDashboardDetails=async(req,res)=>{
    try {
        const id = req.id;
        const [student,fee]=await Promise.all([
   studentApplicationModel.aggregate([
            {$match:{_id:new mongoose.Types.ObjectId(id)}},
            {
                $lookup:{
                    from:"rooms",
                    let:{roomId:"$room_id"},
                    pipeline:[
                        {
                            $match:{
                                $expr:{$eq:["$_id","$$roomId"]}
                            }
                        },
                        {
                            $project:{
                                _id:1,
                                room_no:1
                            }
                        }
                    ],
                    as:"room"
                }
            },
            {$unwind:{path:"$room",preserveNullAndEmptyArrays:true}},
            {
                $lookup:{
                    from:"complaints",
                    let:{
                        studentId:"$_id"
                    },
                    pipeline:[
                        {
                            $match:{
                                $expr:{$eq:["$student_id","$$studentId"]}
                            }
                        },
                        {
                            $project:{
                                _id:1,
                                title:1,
                                description:1,
                                status:1
                            }
                        }
                    ],
                    as:"complaints"
                }
            },
            {
                $project:{
                    student_name:1,
                    student_email:1,
                    student_roll_no:1,
                    student_cellphone:1,
                    postal_address:1,
                    permanent_address:1,
                    cnic_no:1,
                    date_of_birth:1,
                    gender:1,
                    room_no:"$room.room_no",
                    room_id:"$room._id",
                    complaints:1,
                }
            }
        ]),
        FeeInvoiceModel.findOne({student_id:id},'dueDate totalPaid totalAmount').lean({virtuals:true})
        ]);
     
        if(!student)return res.status(404).json({message:"No Student Found."});
        fee.balanceDue=fee.totalAmount - fee.totalPaid;
        fee.feeId=fee._id;
        return res.status(200).send({...fee,dueDate:fee.dueDate.toLocaleDateString(),...student[0]});
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
export const getStudentRoom=async(req,res)=>{
    try {
        const id = req.id;
        const room=await studentApplicationModel.aggregate([
            {$match:{_id:new mongoose.Types.ObjectId(id)}},
            {
                $lookup:{
                    from:"rooms",
                    localField:"room_id",
                    foreignField:"_id",
                    as:"room"
                }
            },
            {$unwind:{path:"$room",preserveNullAndEmptyArrays:false}},
            {
                $lookup:{
                    from:"student_applications",
                    let:{occupantIds:"$room?.occupants",selfId:"$_id"},
                    pipeline:[
                        {$match:{
                            $expr:{
                                $and:[
                                    {$in:["$_id","$$occupantIds"]},
                                    {$ne:["$_id","$$selfId"]}
                                ]
                            }
                        }},
                        {$project:{
                            student_name:1,student_email:1,
                            student_cellphone:1,
                            student_roll_no:1,
                            city:1,
                        }}
                    ],
                    as:"room.occupants_info"
                }
            },
            {
                $lookup:{
                    from:"blocks",
                    localField:"room.block_id",
                    foreignField:"_id",
                    as:"room.block",
                    pipeline:[
                        {$project:{
                            block_no:1
                        }}
                    ]
                }
            },
            {
                $unwind:{
                    path:"$room.block",
                    preserveNullAndEmptyArrays:true
                }
            },
            {
                $project:{
                    // student_name:1,
                    // student_email:1,
                    // student_cellphone:1,
                    // city:1,
                    room:{
                        room_no:1,
                        occupants_info:1,
                        block:1
                    }
                }
            }
        ]);
        console.log(room);
        if(!room[0])return res.status(404).json({message:"No Room Details Found."});
        return res.status(200).json({data:room[0]});
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};
export const getComplaints=async(req,res)=>{
    try {
        const id = req.id;
        const cachedData=await redis.get(`complaints:${id}`);
        console.log(JSON.parse(cachedData));
        if(cachedData)return res.status(200).json({data:JSON.parse(cachedData)});
        const complaints=await ComplainModel.find({student_id:id}).populate("room_id");
        if(complaints.length<=0)return res.sendStatus(204);
        await redis.setex(`complaints:${id}`,3600,JSON.stringify(complaints));
        console.log(complaints);
        return res.status(200).json({data:complaints});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const addComplaint=async(req,res)=>{
    try {
        const id=req.id;
        const {title,category,description,priority}=req.body;
        const student=await studentApplicationModel.findOne({_id:id},"room_id");
        const result = await ComplainModel.create({title,description,category,priority,room_id:student.room_id,student_id:student._id});
        if(!result)return res.sendStatus(400);
        await redis.del(`complaints:${id}`);
        return res.sendStatus(200);
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};
export const changePassword=async(req,res)=>{
    try {
        const id = req.id;
        const {currentPassword,newPassword,confirmPassword}=req.body;
        if(newPassword != confirmPassword)return res.status(400).json({message:"Passwords Not Matched."});
        const student=await userModel.findOne({_id:id});
        if(!student)return res.status(404).json({message:"No Student Record Found."});
        const isMatched=await bcrypt.compare(currentPassword,student.password);
        if(!isMatched)return res.status(400).json({message:"Incorrect Password."});
        student.password=newPassword;
        await student.save();
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const getFees=async(req,res)=>{
    try {
        const id = req.id;
        const [result,totalFee]=await Promise.all([
            await studentApplicationModel.findById(id,"hostelJoinDate hostelLeaveDate").populate({
            path:"room_id",
            select:"fees"
        }).lean(),
        await FeeInvoiceModel.aggregate([
            {$match:{student_id:new mongoose.Types.ObjectId(id)}},
            {
                $group:{
                    _id:null,
                    totalPaid:{$sum:"$totalPaid"}
                }
            }
        ])
        ])
        if(!result)return res.sendStatus(404);
        console.log(result);
        console.log(totalFee);
        const {hostelJoinDate,hostelLeaveDate,room_id}=result;
        const joinTotalMonths=(hostelJoinDate.getFullYear()*12) + hostelJoinDate.getMonth();
        const leaveTotalMonths=(hostelLeaveDate.getFullYear()*12)+hostelLeaveDate.getMonth();
        let monthDif = leaveTotalMonths-joinTotalMonths;
        let totalAmount=(room_id.fees*monthDif);
        return res.status(200).json({totalAmount,totalPaid:totalFee[0].totalPaid,balanceDue:(totalAmount-totalFee[0].totalPaid),progress:(totalAmount/totalFee[0].totalPaid)*100});
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};