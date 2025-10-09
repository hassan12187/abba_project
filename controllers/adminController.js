import roomModel from "../models/roomModel.js";
import studentApplicationModel from "../models/studentApplicationModel.js";
import redis from "../services/Redis.js";   

export const getStudent=async(req,res)=>{
    try {
        const {id}=req.params;
        const studentCached=await redis.get(`student:${id}`);
        if(studentCached)return res.status(200).json({data:JSON.parse(studentCached)});
        const student = await studentApplicationModel.findOne({_id:id});
        if(!student)return res.status(204).json({data:"No matching student record was found."});
        await redis.setex(`student:${id}`,3600,student);
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
        // const cachedKey=query ? `applications:${page}:query:${query}` : `applications:${page}`;
        const resultFromCache = await redis.get(cachedKey);
        if(resultFromCache)return res.status(200).json({data:JSON.parse(resultFromCache),cached:true});

        let filter={};
        if(status !== "approved"){
            filter.status=status;
        }else{
            filter.status={$or:[{status:"pending"},{status:"rejected"}]};
        }
        if(query.trim()!==""){
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
        const {limit,page,query,status,room_assign}=req.query;
        let cachedKey=`student:${page}`;
        if(query)cachedKey+=`:query:${query}`;
        if(status)cachedKey+=`:status:${status}`;
        if(room_assign)cachedKey+=`:room:${room_assign}`;
        const cachedData=await redis.get(cachedKey);
        if(cachedData){
            return res.status(200).json({data:JSON.parse(cachedData)})};
        const students = await studentApplicationModel.find({$or:[{status:'approved'},{status:'accepted'}]}).skip(page*limit).limit(limit).populate("room_id");
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
        const {room_no,total_beds,available_beds,status}=req.body;
        const room = await roomModel.findOne({room_no});
        if(room)return res.status(301).json({data:"Room Already Added."});
        const result = await roomModel.insertOne({room_no,total_beds,available_beds,status});
        const keys = await redis.keys("rooms*");
        if(keys.length>0)await redis.del(keys);
        return res.status(200).json({data:"Room Successfull Added.",result});
    } catch (error) {
    return res.sendStatus(500);
}
};
export const getRooms=async(req,res)=>{
    try {
        const {page,limit,query="",status=""}=req.query;
        let cachedKey=`rooms:${page}`;
        if(query)cachedKey+=`:query:${query}`;
        if(status)cachedKey+=`:status:${status}`;
        const roomsFromCache=await redis.get(cachedKey);
        if(roomsFromCache){
            return res.status(200).json({data:JSON.parse(roomsFromCache)});
        };
        let filterKey={};
        let roomNo=query.toLowerCase();
        if(query)filterKey.room_no={$regex:roomNo,$options:"i"};
        if(status)filterKey.status=status;
        const rooms = await roomModel.find(filterKey).skip(limit*page).limit(limit);
        console.log("rooms",rooms);
        if(rooms.length <=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(rooms));
        return res.status(200).json({data:rooms});
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error"});
    }
}