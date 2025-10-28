import HostelBlockModel from "../../models/HostelBlockModel.js";
import redis from "../services/Redis.js";   

export const handleGetAllBlocks=async(req,res)=>{
    try {
        let cachedKey=`blocks`;
        const cachedData=await redis.get(cachedKey);
        if(cachedData)return res.status(200).json({data:JSON.parse(cachedData)});
        const blocks = await HostelBlockModel.find();
        if(blocks.length<=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(blocks));
        return res.status(200).json({data:blocks});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const handleGetBlocks=async(req,res)=>{
    try {
        const {page,limit,block="",status=""}=req.query;
        let cachedKey=`blocks:page:${page}`;
        if(block)cachedKey+=`:block_no:${block}`;
        if(status)cachedKey+=`:status:${status}`;
        const cachedData=await redis.get(cachedKey);
        if(cachedData)return res.status(200).json({data:JSON.parse(cachedData)});
        let filterKey={};
        if(block){
            filterKey.block_no={$regex:block,$options:'i'};
        }
        if(status)filterKey.status=status;
        if(block && status){
            filterKey={$and:[{block_no:{$regex:block,$options:'i'},status:status}]};
        }
        const result=await HostelBlockModel.find(filterKey).skip(page*limit).limit(limit);
        if(result.length<=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(result));
        console.log("data base quq");
        return res.status(200).json({data:result});
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};
export const handleAddBlock=async(req,res)=>{
    try {
        const {block_no,description,total_rooms,status}=req.body;
        const isExist = await HostelBlockModel.findOne({block_no});
        if(isExist)return res.sendStatus(422);
        const newBlock=new HostelBlockModel({block_no,description,total_rooms,status});
        const isTrue=await newBlock.save();
        if(!isTrue)return res.sendStatus(400);
        let cursor="0";
        do{
            const reply = await redis.scan(cursor,'MATCH','blocks*','COUNT',100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length>0){
                await redis.del(...keys);
            }
        }
        while(cursor !== "0");
        return res.sendStatus(200);
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};
export const handleGetBlock=async(req,res)=>{
    try {
        const {id} = req.params;
        const cachedData=await redis.get(`blocks:${id}`);
        if(cachedData)return res.status(200).json({data:JSON.parse(cachedData)});
        const block=await HostelBlockModel.findOne({_id:id});
        if(!block)return res.sendStatus(204);
        await redis.setex(`blocks:${id}`,3600,JSON.stringify(block));
        return res.status(200).json({data:block});
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};
export const handleEditBlock=async(req,res)=>{
    try {
        const {id}=req.params;
        const result=await HostelBlockModel.findOneAndUpdate({_id:id},{$set:req.body});
        if(!result)return res.sendStatus(403);
        await redis.del(`blocks:${id}`);
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
}