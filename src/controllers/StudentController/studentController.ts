import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../../services/Redis.js";
import mongoose from "mongoose";
import ComplainModel from "../../models/complaintModel.js";
import userModel from "../../models/userModel.js";
import bcrypt from "bcrypt";
import FeeInvoiceModel from "../../models/FeeInvoice.js";
import {type Request,type Response} from "express";

interface AuthenticatedRequest extends Request {
    id?: string;
}
// Student Get Details
export const getStudentDashboardDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = req.id;

        const [studentArray, fee] = await Promise.all([
            studentApplicationModel.aggregate([
                { $match: { _id: new mongoose.Types.ObjectId(id) } },
                {
                    $lookup: {
                        from: "rooms",
                        localField: "room_id",
                        foreignField: "_id",
                        as: "room"
                    }
                },
                { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: "complaints",
                        localField: "_id",
                        foreignField: "student_id",
                        as: "complaints"
                    }
                },
                {
                    $project: {
                        student_name: 1,
                        student_email: 1,
                        student_roll_no: 1,
                        student_cellphone: 1,
                        postal_address: 1,
                        permanent_address: 1,
                        cnic_no: 1,
                        date_of_birth: 1,
                        gender: 1,
                        room_no: "$room.room_no",
                        room_id: "$room._id",
                        complaints: 1,
                    }
                }
            ]),
            FeeInvoiceModel.findOne({ student_id: id }, 'dueDate totalPaid totalAmount')
                .sort({ createdAt: -1 }) // Get the most recent invoice
                .lean()
        ]);

        // 1. Check if aggregation returned a student
        if (!studentArray || studentArray.length === 0) {
            return res.status(404).json({ message: "No Student Found." });
        }

        const studentData = studentArray[0];

        // 2. Handle cases where no fee invoice exists yet
        let feeData = {};
        if (fee) {
            feeData = {
                ...fee,
                feeId: fee._id,
                balanceDue: (fee.totalAmount || 0) - (fee.totalPaid || 0),
                dueDate: fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : 'N/A'
            };
        }

        // 3. Merge data (student info takes priority)
        return res.status(200).json({
            ...feeData,
            ...studentData
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getRoomMates=async(req:any,res:any)=>{
    try {
        const id = req.id;
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getStudentRoom=async(req:any,res:any)=>{
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
export const getComplaints=async(req:any,res:any)=>{
    try {
        const id = req.id;
        const cachedData=await redis.get(`complaints:${id}`);
        // console.log(JSON.parse(cachedData));
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

export const addComplaint = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const studentId = req.id;
        const { title, category, description, priority } = req.body;

        // 1. Basic Validation
        if (!title || !category || !description) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // 2. Fetch student and handle "Not Found" case safely
        const student = await studentApplicationModel.findById(studentId, "room_id");
        
        if (!student) {
            return res.status(404).json({ message: "Student record not found" });
        }

        // 3. Create the complaint
        const result = await ComplainModel.create({
            title,
            description,
            category,
            priority: priority || "medium", // Default priority if not provided
            room_id: student.room_id,
            student_id: student._id
        });

        if (!result) {
            return res.status(400).json({ message: "Failed to create complaint" });
        }

        // 4. Cache Invalidation
        // It's a good idea to delete both the specific student's list 
        // and any global admin lists if they exist.
        await redis.del(`complaints:${studentId}`);

        return res.status(201).json({ message: "Complaint filed successfully", id: result._id });

    } catch (error) {
        console.error("Error adding complaint:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
export const changePassword=async(req:any,res:any)=>{
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

export const getFees=async(req:any,res:any)=>{
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
        const {hostelJoinDate,hostelLeaveDate,room_id}=result as any;
        if(!hostelJoinDate || !room_id || !room_id.fees){
            return res.status(404).json({message:"Incomplete record: missing dates or room fees"})
        };
        const endDay = hostelLeaveDate ? new Date(hostelLeaveDate) : new Date();
        const startDay=new Date(hostelJoinDate);
        const joinTotalMonths=(startDay.getFullYear()*12) + hostelJoinDate.getMonth();
        const leaveTotalMonths=(endDay.getFullYear()*12)+hostelLeaveDate.getMonth();
        let monthDif =Math.max(1,leaveTotalMonths-joinTotalMonths);
        const totalAmount=(room_id.fees*monthDif);
        return res.status(200).json({totalAmount,totalPaid:totalFee[0].totalPaid,balanceDue:(totalAmount-totalFee[0].totalPaid),progress:(totalAmount/totalFee[0].totalPaid)*100});
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};