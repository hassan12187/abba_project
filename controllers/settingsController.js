import userModel from "../models/userModel.js";
import redis from "../services/Redis.js";

export const getProfileInformation=async(req,res)=>{
    try {
        const id = req.id;
        const cachedData=await redis.get(`details:${id}`);
        let parsedData=JSON.parse(cachedData);
        if(cachedData)return res.status(200).json({data:{email:parsedData?.email,username:parsedData?.username,id:parsedData?._id}});
        const user=await userModel.findOne({_id:id});
        if(!user)return res.sendStatus(204);
        await redis.setex(`details:${id}`,3600,JSON.stringify(user));
        return res.status(200).json({data:{email:user.email,username:user.username,id:user._id}});
    } catch (error) {
        return res.sendStatus(500);
    }
}
export const handleProfileInformation=async(req,res)=>{
    try {
        const {id}=req.params;
        const result = await userModel.findByIdAndUpdate({_id:id},{$set:req.body});
        if(!result)return res.sendStatus(408);

    } catch (error) {
        return res.sendStatus(500);
    }
};