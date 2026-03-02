import MessMenuModel from "../../models/MessMenu.js";
import redis from "../../services/Redis.js";   


export const getMessMenu=async(req,res)=>{
    try {
        const cacheResults=await redis.get("messMenu");
        if(cacheResults)return res.status(200).send(JSON.parse(cacheResults));
       const result =  await MessMenuModel.find();
       if(result.length < 0)return res.status(404).json({message:"No Menu Found"});
       await redis.setex("messMenu",3600,JSON.stringify(result));
       return res.status(200).json(result);
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const updateMessMenu=async(req,res)=>{
    try {
        const day = req.params.day;
        const {messItems="",timing="",type=""}=req.body;
        if(type=="" || messItems=="")return res.sendStatus(503);
        let result = messItems?.trim().split(",").map(c=>c.trim());
        let tim = timing.split("-").map(c=>c.trim());
        const re = await MessMenuModel.findOneAndUpdate({dayOfWeek:day},{$set:{type:{
            items:result,
            startTime:tim[0],
            endTime:tim[1]
        }}});
        if(!re)return res.sendStatus(503);
        let cursor = "0";
        do {
            const reply = await redis.scan(cursor,"MATCH","messMenu*","COUNT",100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length>0)await redis.del(...keys);
        } while (cursor!=="0");
        return res.sendStatus(200);
    } catch (error) {
        console.log(error);
        
        return res.sendStatus(500);
    }
};