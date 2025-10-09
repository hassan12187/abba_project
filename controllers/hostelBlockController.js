import HostelBlockModel from "../models/HostelBlockModel.js";
import redis from "../services/Redis.js";   

export const handleGetBlocks=async(req,res)=>{
    try {
        const {block}=req.query;
        let cachedKey=`block:${block}`;
        const cachedData=await redis.get(cachedKey);
        if(cachedData)return res.status(200).json({data:JSON.parse(cachedData)});
        const blocks = await HostelBlockModel.find({block_no:block});
        if(blocks.length<=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(blocks));
        return res.status(200).json({data:blocks});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const handleAddBlock=async(req,res)=>{
    try {
        const {block_no,description,total_rooms}=req.body;
        const isExist = await HostelBlockModel.findOne({block_no});
        if(isExist)return res.sendStatus(205);
        const newBlock=new HostelBlockModel({block_no,description,total_rooms});
        const isTrue=await newBlock.save();
        if(!isTrue)return res.sendStatus(400);
        let cursor="0";
        do{
            const reply = await redis.scan(cursor,'MATCH','block*','COUNT',100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length>0){
                await redis.del(...keys);
            }
        }
        while(cursor !== "0");
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
}