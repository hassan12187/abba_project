import roomModel from "../hostel/room.model.js";
import {type Request,type Response} from "express"
import redis from "../../services/Redis.js";   

export const addRoom=async(req:Request,res:Response)=>{
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
export const getRoom=async(req:Request,res:Response)=>{
try {
    const {id}=req.params;
    const cachedRoom=await redis.get(`rooms:${id}`);
    if(cachedRoom)return res.status(200).json({data:JSON.parse(cachedRoom)});
    const room = await roomModel.findOne({_id:id}).populate([
        {path:"block_id",select:"block_no"},
        {path:"occupants",select:"student_name student_email student_roll_no"}
    ]);
    console.log(room);
    if(!room)return res.sendStatus(204);
    await redis.setex(`room:${id}`,3600,JSON.stringify(room));
    return res.status(200).json({data:room});
} catch (error) {
    console.log(error);
    return res.sendStatus(500);
}
};
export const getRooms=async(req:Request,res:Response)=>{
    try {
        const page:number=parseInt(req.query.page as string)||0;
        const limit:number=parseInt(req.query.limit as string)||10;
        const query = (req.query.query as string) || "";
        const status=(req.query.status as string) || "";
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
        let filterKey:{room_no?:{$regex:string,$options:string},status?:string}={};
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
export const handleGetRoomsWithBlock=async(req:Request,res:Response)=>{
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