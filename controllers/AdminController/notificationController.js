import NotificationModel from "../../models/notificationModel.js";
// import redis from "../services/Redis.js";

export const getNotifications=async(req,res)=>{
    try {
        const notifications = await NotificationModel.find().limit(10);
        // const cachedNotifications = await redis.get("notifications");
        // let cachedNoti = JSON.parse(cachedNotifications);
        // if(cachedNotifications || cachedNoti>0)return res.status(200).json({data:cachedNoti});
        if(notifications.length<=0)return res.sendStatus(204);
        // await redis.setex('notifications',3600,JSON.stringify(notifications),(err,res)=>{
        //     try {
        //         console.log("success ",res)
        //     } catch (error) {
        //         console.log(`if errro ${err}`);
        //         console.log("else rrror ",error);
        //     }
        // });
        return res.status(200).json({data:notifications});
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const markNotificationsRead=async(req,res)=>{
    try {
        const result = await NotificationModel.updateMany({isRead:false},{$set:{isRead:true}});
        if(!result.acknowledged)return res.status(400);
        // let cursor ="0";
        // do{
        //     const reply = await redis.scan(cursor,'MATCH','notifications*','COUNT',100);
        //     cursor=reply[0];
        //     const keys = reply[1];
        //     if(keys.length>0){
        //         await redis.del(...keys);
        //     }
        // }while(cursor !== "0");
        // // await redis.del(await redis.keys("notifications*"))
        return res.sendStatus(200)
    } catch (error) {
        return res.sendStatus(500);
    }
}