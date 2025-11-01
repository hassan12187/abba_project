import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../..//services/Redis.js";
import mongoose from "mongoose";


// Student Get Details
export const getStudentDetails=async(req,res)=>{
    try {
        const id = req.id;
        const student=await studentApplicationModel.aggregate([
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
                    _id:1,
                    student_name:1,
                    student_email:1,
                    student_roll_no:1,
                    student_cellphone:1,
                    postal_address:1,
                    permanent_address:1,
                    cnic_no:1,
                    date_of_birth:1,
                    gender:1,
                    room:1,
                    complaints:1,
                    // dob:date_of_birth
                }
            }
        ]);
        if(!student)return res.status(404).json({message:"No Student Found."});
        // const dataModel={
        //     id:student._id,
        //     name:student.student_name,
        //     email:student.student_email,
        //     phone_no:student.student_cellphone,
        //     current_address:student.postal_address,
        //     permanent_address:student.permanent_address,
        //     room:student.room_id,
        //     cnic:student.cnic_no,
        //     dob:new Date(student.date_of_birth).toLocaleDateString(),
        //     gender:student.gender
        // };
        return res.status(200).json({data:student[0]});
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
            {$unwind:{path:"$room",preserveNullAndEmptyArrays:true}},
            {
                $lookup:{
                    from:"student_applications",
                    let:{occupantIds:"$room.occupants",selfId:"$_id"},
                    pipeline:[
                        {$match:{
                            $expr:{
                                $and:[
                                    {$in:["$_id","$$occupantIds"]},
                                    {$ne:["$_id","$$selfId"]}
                                ]
                                // $in:["$_id","$$occupantIds"]
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
                $project:{
                    // student_name:1,
                    // student_email:1,
                    // student_cellphone:1,
                    // city:1,
                    room:{
                        room_no:1,
                        occupants_info:1
                    }
                }
            }
        ])
        if(!room[0])return res.status(404).json({message:"No Room Details Found."});
        return res.status(200).json({data:room[0]});
    } catch (error) {
        return res.sendStatus(500);
    }
}