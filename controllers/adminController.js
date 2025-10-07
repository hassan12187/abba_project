import { io } from "../index.js";
import roomModel from "../models/roomModel.js";
import studentApplicationModel from "../models/studentApplicationModel.js";
import redis from "../services/Redis.js";   

export const getStudent=async(req,res)=>{
    try {
        const {id}=req.params;
        const student = await studentApplicationModel.findOne({_id:id});
        if(student===null)return res.status(204).json({data:"No matching student record was found."});
        return res.status(200).json({data:student});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getStudentApplications=async(req,res)=>{
   try {
        const {page=0,limit=10,query=""}=req.query;
        const cachedKey=query ? `applications:${page}:query:${query}` : `applications:${page}`;
        const resultFromCache = await redis.get(cachedKey);
        if(resultFromCache)return res.status(200).json({data:JSON.parse(resultFromCache),cached:true});

        let filter={
            $or:[{status:"pending"},{status:"rejected"}]
        };
        if(query.trim()!==""){
            let isNum=!isNaN(query);
            if(isNum){
                filter={
                    $and:[
                        {
                            $or:[{status:"pending"},{status:"rejected"}]
                        },
                        {
                            student_roll_no:Number(query)
                        }
                    ]
                }
            }else{

                filter={
                    $and:[
                        {$or:[{status:"pending"},{status:"rejected"}]},
                        {
                            student_name:{$regex:query,$options:'i'}
                        }
                    ]
                }
            }
        }
        const students = await studentApplicationModel.find(filter).skip(limit*page).limit(limit);
        await redis.setex(cachedKey,3600,JSON.stringify(students));
        if(students.length==0)return res.status(204).json({data:"No Student Applications"});
        return res.status(200).json({data:students});
    } catch (error) {
        console.log(`the error is `,error);
        return res.status(500).json({data:"Oops! A server error occurred."});
    }
};

export const getAllStudents=async(req,res)=>{
    try {
        const {limit,page}=req.query;
        const students = await studentApplicationModel.find({status:"approved"}).skip(page*limit).limit(limit).populate("room_id");
        if(students.length==0)return res.status(204).json({data:"No Student Applications"});
        return res.status(200).json({data:students});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const editStudent=async(req,res)=>{
    try {
        const {id}=req.params;
        // const {first_name,last_name,status,application_status,cnic,cellphone,room_id,address,emergency_contact,registration_date}=req.body;
        const student = await studentApplicationModel.findOneAndUpdate({_id:id},{$set:req.body});
        console.log(student);
        return res.status(200).json({data:"Student Appication Status Updated."});
        // if(student===null)return res.send({status:400,data:"No Student Found."});
    } catch (error) {
        return res.sendStatus(500);
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
        if(room!=null)return res.status(204).json({data:"Room Already Added."});
        const result = await roomModel.insertOne({room_no,total_beds,available_beds});
        const keys = await redis.keys("room:*");
        if(keys.length>0)await redis.del(keys);
        return res.status(200).json({data:"Room Successfull Added.",result});
    } catch (error) {
    return res.sendStatus(500);
}
};
export const getRooms=async(req,res)=>{
    try {
        const {page,limit}=req.query;
        const roomsFromCache=await redis.get(`room:${page}`);
        if(roomsFromCache && JSON.parse(roomsFromCache).length >0){
            return res.status(200).json({data:JSON.parse(roomsFromCache)});
        }
        // if(roomsFromCache || JSON.parse(roomsFromCache).length)
        const rooms = await roomModel.find().skip(limit*page).limit(limit);
        if(rooms.length <=0)return res.status(404).json({data:"No Room Found"});
        await redis.setex(`room:${page}`,3600,JSON.stringify(rooms));
        return res.status(200).json({data:rooms});
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error"});
    }
}