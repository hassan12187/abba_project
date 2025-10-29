import { startSession } from "mongoose";
import roomModel from "../../models/roomModel.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../../services/Redis.js";   
import { sentLoginCredToApproveStudent } from "../../services/emailJobs.js";
import generatePassword from "../../services/generatePassword.js";
import bcrypt from "bcrypt";
import userModel from "../../models/userModel.js";

export const approveStudentApplication=async(req,res)=>{
    console.log("approving student application");
    const session = await startSession();
    session.startTransaction();
    try {
        const {id}=req.params;
        const student=await studentApplicationModel.findOne({_id:id}).session(session);
        if(!student)return res.status(404).json({message:"Student Not Found."});
        if(student.status=="approved"){
            return res.status(400).json({message:"Student Already Approved."});
        }
        const isExistingUser=await userModel.findOne({email:student.student_email}).session(session);
        if(isExistingUser)return res.status(400).json({message:"User Already Exist."});
        const password=generatePassword();
        student.status="approved";
        await student.save({session});
        await userModel.create([{
            email:student.student_email,password:password,phone:student.student_cellphone,username:student.student_name,role:"STUDENT"}],{session});
        await session.commitTransaction();
        await session.endSession();
        await sentLoginCredToApproveStudent(student.student_email,password);
        return res.status(200).json({message:"Student approved Successfully."});
    } catch (error) {
        await session.abortTransaction();
        await session.endSession();
        return res.sendStatus(500);
    }
};

export const getStudent=async(req,res)=>{
    console.log("me toh agya abba");
    try {
        const {id}=req.params;
        const studentCached=await redis.get(`student:${id}`);
        console.log(JSON.parse(studentCached));
        if(studentCached)return res.status(200).json({data:JSON.parse(studentCached)});
        const student = await studentApplicationModel.findOne({_id:id}).populate("room_id");
        if(!student)return res.status(204).json({data:"No matching student record was found."});
        await redis.setex(`student:${id}`,3600,JSON.stringify(student));
        return res.status(200).json({data:student});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getStudentApplications=async(req,res)=>{
   try {
        const {page=0,limit=10,query="",status=""}=req.query;
        let cachedKey=`applications:${page}`;
        if(query)cachedKey+=`:query:${query}`;
        if(status)cachedKey+=`:status:${status}`;
        const resultFromCache = await redis.get(cachedKey);
        if(resultFromCache)return res.status(200).json({data:JSON.parse(resultFromCache),cached:true});

        let filter={};
        if(status && status !== "approved"){
            filter.status=status;
        }else{
            filter=  {   $or:[{status:"pending"},{status:"rejected"}]
                        };
        }
        if(query){
            let isNum=!isNaN(query);
            if(isNum){
                filter={
                    $and:[
                        {
                            $or:[{status:"pending"},{status:"rejected"}]
                        },
                        {
                            $or:[{student_cellphone:Number(query)},{student_roll_no:Number(query)} ]
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
        const {limit,page,query,status="",room_assign=""}=req.query;
        // console.log(status);
        let cachedKey=`student:${page}`;
        if(query)cachedKey+=`:query:${query}`;
        if(status)cachedKey+=`:status:${status}`;
        if(room_assign)cachedKey+=`:room:${room_assign}`;
        const cachedData=await redis.get(cachedKey);
        if(cachedData){return res.status(200).json({data:JSON.parse(cachedData)})};
       let filterKey = {};

    // If admin filters by status (accepted, approved, etc.)
    if (status) {
      filterKey.status = status;
    }else{
        filterKey={$or:[{status:"approved"},{status:"accepted"}]}
    }

    // If admin searches with query
    if (query) {
      const isNumber = !isNaN(query); // true if numeric
      if (isNumber) {
        // 🔹 Numeric query means search by cellphone
        filterKey.student_cellphone = query;

        // 🔹 If admin has not selected status, but you want to include both approved/accepted


      } else {
        // 🔹 Text query (search by student name)
        filterKey.student_name = { $regex: query, $options: "i" };
      }
    }

    // 🔹 If admin filters by "room not assigned"
    if (room_assign === "room_not_assigned") {
      filterKey.room_id = null;
    }

        console.log("fulter ",filterKey)
        const students = await studentApplicationModel.find(filterKey).skip(page*limit).limit(limit).populate("room_id");
        console.log(students)
        if(students.length<=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(students));
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
        if(!student)return res.sendStatus(500);
        let cursor="0";
        do {
            const reply = await redis.scan(cursor,'MATCH','student*','COUNT',100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length>0){
                await redis.del(...keys);
            }
        } while (cursor!=="0");
        console.log(student);
        return res.status(200).json({data:"Student Appication Status Updated."});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const assignRoom=async(req,res)=>{
    try {
        const {id}=req.params;
        const {room_id}=req.body;
        if(!room_id){
            let status = await removeRoom(id)
            return res.sendStatus(status);
        };

        const session = await startSession();
        session.startTransaction();
        try {
            await studentApplicationModel.findOneAndUpdate({_id:id},{$set:{room_id:room_id}},{session});
            const room = await roomModel.findOne({_id:room_id});
            if(room.available_beds<=0){
                session.abortTransaction();
                return res.status(403).send("No Beds Available.")};
                if(!room){
                    session.abortTransaction();
                    return res.sendStatus(204)};
                    room.available_beds-=1;
                    await room.save({session});
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            return res.status(403).send("Error Assigning Room.");
        }finally{
            await session.endSession();
        };
        let cursor ="0";
             do {
            const reply = await redis.scan(cursor,'MATCH','student*','COUNT',100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length>0){
                await redis.del(...keys);
            }
        } while (cursor!=="0");
        return res.status(200).json({data:"Student Appication Status Updated."});
        // if(student===null)return res.send({status:400,data:"No Student Found."});
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
}
const removeRoom=async(id)=>{
    const session = await startSession();
    session.startTransaction();
    try {
        const student = await studentApplicationModel.findById(id).session(session);
        if(!student){
            await session.abortTransaction();
            return 204;
        };
        const room_id=student.room_id;
        await studentApplicationModel.updateOne({_id:id},{$unset:{room_id:""}},{session});  
        if(!room_id){
            await session.abortTransaction();
            return 400;
        };
        await roomModel.updateOne({_id:room_id},{$inc:{available_beds:1}},{session});
        await session.commitTransaction();
        return 200;
    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        return 500;
    }finally{
        let cursor = "0";   
                do {
            const reply = await redis.scan(cursor,'MATCH','student*','COUNT',100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length>0){
                await redis.del(...keys);
            }
        } while (cursor!=="0");
        await session.endSession();
    };
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
        const {room_no,total_beds,available_beds,status,block_id}=req.body;
        const room = await roomModel.findOne({room_no});
        if(room)return res.status(301).json({data:"Room Already Added."});
        const result = await roomModel.create({room_no,total_beds,available_beds,status,block_id});
        let cursor = "0";
        do{
            const reply = await redis.scan(cursor,'MATCH','rooms*','COUNT',100);
            cursor = reply[0];
            const keys = reply[1];
            if(keys.length >0){
                await redis.del(...keys);
            }
        }while(cursor !== "0");
        const keys = await redis.keys("rooms*");
        if(keys.length>0)await redis.del(keys);
        return res.status(200).json({data:"Room Successfull Added.",result});
    } catch (error) {
    return res.sendStatus(500);
}
};
export const getRoom=async(req,res)=>{
try {
    const {id}=req.params;
    const cachedRoom=await redis.get(`room:${id}`);
    if(cachedRoom)return res.status(200).json({data:JSON.parse(cachedRoom)});
    const room = await roomModel.findOne({_id:id}).populate(['block_id','amenities']);
    if(!room)return res.sendStatus(204);
    await redis.setex(`room:${id}`,3600,JSON.stringify(room));
    return res.status(200).json({data:room});
} catch (error) {
    return res.sendStatus(500);
}
};
export const getRooms=async(req,res)=>{
    try {
        const {page,limit,query="",status=""}=req.query;
        const statCachedKey='rooms:stats';
        let cachedKey=`rooms:${page}`;
        if(query)cachedKey+=`:query:${query}`;
        if(status)cachedKey+=`:status:${status}`;
        const roomsFromCache=await redis.get(cachedKey);
        let roomStatsFromCache;
        if(roomStatsFromCache)roomStatsFromCache=JSON.parse(roomStatsFromCache);
        else{
            const roomStatsAgg = await roomModel.aggregate([{$group:{_id:"$status",count:{$sum:1}}}]);
            const totalRooms=await roomModel.countDocuments();
            const stats={
                totalRooms,
                availableRooms:roomStatsAgg.find(r => r._id==="available")?.count||0,
                occupiedRooms:roomStatsAgg.find(r => r._id==="occupied")?.count||0,
                maintenanceRooms:roomStatsAgg.find(r => r._id==="maintenance")?.count || 0
            };
            roomStatsFromCache=stats;
            await redis.setex(statCachedKey,3600,JSON.stringify(stats));
        }
        if(roomsFromCache){
            return res.status(200).json({data:JSON.parse(roomsFromCache),stats:roomStatsFromCache});
        };
        let filterKey={};
        let roomNo=query.toLowerCase();
        if(query)filterKey.room_no={$regex:roomNo,$options:"i"};
        if(status)filterKey.status=status;
        const rooms = await roomModel.find(filterKey).skip(limit*page).limit(limit);
        if(rooms.length <=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(rooms));
        return res.status(200).json({data:rooms,stats:roomStatsFromCache});
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error"});
    }
};
export const handleGetRoomsWithBlock=async(req,res)=>{
    console.log("yes im here bro");
    try {
        const {block}=req.query;
        const cachedKey=`rooms_and_block:${block}`;
        const cachedData=await redis.get(cachedKey);
        if(cachedData)return res.status(200).json({data:JSON.parse(cachedData)});
        const result = await roomModel.find({block_id:block});
        if(result.length<=0)return res.sendStatus(204);
        await redis.setex(cachedKey,3600,JSON.stringify(result));
        return res.status(200).json({data:result});
    } catch (error) {
        return res.sendStatus(500);
    }
}