import NotificationModel from "../models/notificationModel.js";
import redis from "../services/Redis.js";

export const getNotifications=async(req,res)=>{
    try {
        const notifications = await NotificationModel.find().limit(10);
        const cachedNotifications = await redis.getex("notifications");
        let cachedNoti = JSON.parse(cachedNotifications);
        if(cachedNotifications || cachedNoti>0)return res.status(200).json({data:cachedNoti});
        if(notifications.length<=0)return res.sendStatus(204);
        await redis.setex('notifications',3600,JSON.stringify(notifications),(err,res)=>{
            try {
                console.log("success ",res)
            } catch (error) {
                console.log(`if errro ${err}`);
                console.log("else rrror ",error);
            }
        });
        return res.status(200).json({data:notifications});
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const markNotificationsRead=async(req,res)=>{
    try {
        const result = await NotificationModel.updateMany({isRead:false},{$set:{isRead:true}});
        if(!result.acknowledged)return res.status(400);
        await redis.del("notifications");
        return res.sendStatus(200)
    } catch (error) {
        return res.sendStatus(500);
    }
}