import { Types } from "mongoose";
import AttendanceRecord from "../../models/mealAttendance.js";
import MessMenuModel from "../../models/MessMenu.js";
import MessSubscription from "../../models/MessSubscription.js";
import redis from "../../services/Redis.js";   
import type { Request,Response } from "express";

interface AuthenticatedRequest extends Request{
    id?:string
};

export const getMessMenu=async(req:Request,res:Response)=>{
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
export const getStudentMessDetails=async(req:AuthenticatedRequest,res:Response)=>{
    try {
        const dayOfWeek = req.query.day;
        const type:string|undefined = req.query.type as string;
        const id =req?.id;
        if(type=="attendance" && id){
            const cachedAttendance=await redis.get(`studentAttendance:${id}`);
            if(cachedAttendance){
                return res.status(200).send(JSON.parse(cachedAttendance));
            };
            const objResult=await handleGetAttendance(id);
            await redis.setex(`studentAttendance:${id}`,3500,JSON.stringify(objResult));
            return res.status(200).send(objResult);
        }
        if(!dayOfWeek)return res.status(500).json({message:"Wrong day."});
        const cachedMenu:string|null=await redis.get(`messMenu:${dayOfWeek}`);
        if(cachedMenu){
            return res.status(200).send(cachedMenu)};
        const result = await MessMenuModel.findOne({dayOfWeek},"breakfast lunch dinner");
        if(!result)return res.status(404).json({message:"No Menu Found."});
            const dataModel={
                menu:[{name:"Breakfast",...result.breakfast},{name:"Lunch",...result.lunch},{name:"Dinner",...result.dinner}],
                id:result._id};
        await redis.setex(`messMenu:${dayOfWeek}`,3500,JSON.stringify(dataModel));
        return res.status(200).send(dataModel);
    } catch (error) {
        return res.sendStatus(500);
    }
};
interface Attendance{
 totalMeals:number,
        presentMeals:number,
        attendancePercentage:number,
        recentAttendanceHistory:Map<string,any>[]
};
const handleGetAttendance=async(id:string):Promise<Attendance>=>{
    const now=new Date();
    const startOfMonth=new Date(now.getFullYear(),now.getMonth(),1);
    const endOfMonth=new Date(now.getFullYear(),now.getMonth()+1,0, 23, 59, 59);
    const fiveDaysBehind=new Date(now.getFullYear(),now.getMonth(),now.getDate()-5);
    const studentId=new Types.ObjectId(id);
    const [attendanceStats,recentAttendance]=await Promise.all([
        AttendanceRecord.aggregate([
            {$match:{student:studentId,date:{$gt:startOfMonth,$lte:endOfMonth}}},
            {
                $group:{
                    _id:null,
                    totalMeals:{$sum:1},
                    presentMeals:{
                        $sum:{$cond:[{$eq:['$status','Present']},1,0]}
                    },
                }
            },
            
        ]),
        AttendanceRecord.find({student:studentId,date:{$gt:fiveDaysBehind,$lte:now}},"mealType status date").sort({date:-1}).limit(15).lean()
    ]);
    const stats=attendanceStats[0]||{totalMeals:0,presentMeals:0}
    const attendanceMap=new Map<string,any>();
    for(const item of recentAttendance){
 const key = item.date.toISOString().split('T')[0] as string;
        // const isMappedEntry = attendanceMap.get(key);
        if(!attendanceMap.has(key)){
              attendanceMap.set(key,{
                date:item?.date,
                total:0
            });
        };
        const entry=attendanceMap.get(key);
          if(!entry[item?.mealType]){
                    entry[item.mealType]=item.status;
                    if(item.status==="Present"){
                        entry.total+=1;
                    }
                };
    };

    const mealAttendancePercentage=stats.totalMeals > 0?
    Math.floor((stats.presentMeals/stats.totalMeals)*100):0
    const dataModel:Attendance={
        totalMeals:attendanceStats[0]?.totalMeals,
        presentMeals:attendanceStats[0]?.presentMeals,
        attendancePercentage:mealAttendancePercentage,
        recentAttendanceHistory:Array.from(attendanceMap.values())
    };
    return dataModel;
};
export const getAllSubscriptions=async(req:Request,res:Response)=>{
    try {
        const page = parseInt(req.query.page as string)||0;
        const limit = parseInt(req.query.limit as string)||10;
        const q=req.query.q;
        const cachedSubscriptions:string|null=await redis.get(`subscriptions:${page}`);
        if(cachedSubscriptions)return res.send(200).send(JSON.parse(cachedSubscriptions));
        const result = await MessSubscription.find({}).skip(page*limit).limit(limit).populate({
            path:"student_application",
            select:"student_name"
        });
        if(result.length<=0)return res.status(404).send("No Subscriptions Found.");
        await redis.setex(`subscriptions:${page}`,3500,JSON.stringify(result));
        return res.status(200).send(result);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const updateMessMenu=async(req:Request,res:Response)=>{
    try {
        const day = req.params.day;
        const {messItems="",timing="",type=""}=req.body;
        if(type=="" || messItems=="")return res.sendStatus(503);
        let result = messItems?.trim().split(",").map((c:string)=>c.trim());
        let tim = timing.split("-").map((c:string)=>c.trim());
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

export const getMessAttendance=async(req:Request,res:Response)=>{
    try {
        const page:number=parseInt(req.query.page as string)||0;
        const limit:number=parseInt(req.query.limit as string)||10;
        const currentDate=new Date(parseInt(req.query.date as string))||Date.now();
        const messAttendace=await AttendanceRecord.find({date:currentDate}).skip(page*limit).limit(limit);
        if(!messAttendace || messAttendace.length<=0)return res.status(500).json({message:"No Attendance Found."});
        return res.status(200).send(messAttendace);
    } catch (error) {
        return res.sendStatus(500);
    }
};

// Define standard pricing (this could also come from a DB config table)
// type PricingPlan= keyof typeof PRICING;
const PRICING:Record<string,number>= {
    "Monthly": 3000,
    "Semester": 15000, 
    "Pay_Per_Meal": 0 // Fee is calculated per swipe/entry elsewhere
};

export const createSubscription=async(req:Request,res:Response) =>{
    try {
        const studentId = req.params.studentId;
        const planType=req.body.planType;
        // 1. Check if subscription already exists (Schema enforces uniqueness, but good to catch early)
        const existingSub = await MessSubscription.findOne({ student: studentId });
        if (existingSub) {
            return res.status(500).json({message:"Student already has a mess subscription."});
        };

        // 2. Calculate validUntil date based on plan
        const currentDate = new Date();
        let expiryDate = new Date();

        if (planType === 'Monthly') {
            expiryDate.setMonth(currentDate.getMonth() + 1);
        } else if (planType === 'Semester') {
            expiryDate.setMonth(currentDate.getMonth() + 6);
        } else if (planType === 'Pay_Per_Meal') {
            // Pay-per-meal might be valid for the whole academic year
            expiryDate.setFullYear(currentDate.getFullYear() + 1); 
        }
        
        // 3. Create the document
        const newSubscription = new MessSubscription({
            student: studentId,
            planType: planType,
            monthlyFee: PRICING[planType],
            validUntil: expiryDate,
            status: 'Active'
        });

        await newSubscription.save();
        return res.status(200).send(newSubscription);

    } catch (error) {
        console.error("Error creating subscription:", error);
        throw error;
    }
}
export const verifyMessAccess=async(req:Request,res:Response) =>{
    try {
        const studentId=req.params.studentId;
        const subscription = await MessSubscription.findOne({ student: studentId });

        // 1. Check if they have a profile
        if (!subscription) {
            return res.status(404).json({allowed:false,reason: "No subscription found."});
        }

        // 2. Check if the account is suspended or cancelled
        if (subscription.status !== 'Active') {
            return res.status(404).json({ allowed: false, reason: `Subscription is ${subscription.status}.` });
        }

        // 3. Check if the subscription has expired
        const currentDate = new Date();
        if (subscription.validUntil && currentDate > subscription.validUntil) {
            return res.status(404).json({ allowed: false, reason: "Subscription has expired. Please renew." });
        }

        // 4. Handle Pay-Per-Meal logic (Optional: check if they have enough wallet balance)
        if (subscription?.planType === 'Pay_Per_Meal') {
            // e.g., const balance = await Wallet.checkBalance(studentId);
            // if (balance < MEAL_COST) return { allowed: false, reason: "Insufficient balance" }
        }

        return res.status(200).json({ allowed: true, message: "Access granted." });

    } catch (error) {
        return res.status(500).send("Access verification failed.");
    }
};
export const renewSubscription=async(req:Request,res:Response)=> {
    try {
        const studentId=req.params.studentId;
        const monthsToExtend=req.body.monthsToExtend;
        const subscription = await MessSubscription.findOne({ student: studentId });
        if (!subscription) return res.status(404).json({message:"Subscription not found."});

        // If it was expired/suspended, activate it
        if (subscription.status !== 'Active') {
            subscription.status = 'Active';
        }

        // Extend the date
        const currentDate = new Date();
        if(!subscription?.validUntil)return res.sendStatus(500);
        const baseDate = subscription?.validUntil > currentDate ? subscription.validUntil : currentDate;
        
        const newExpiry = new Date(baseDate);
        newExpiry.setMonth(newExpiry.getMonth() + monthsToExtend);

        subscription.validUntil = newExpiry;
        await subscription.save();

        return res.status(200).send(subscription);
        
    } catch (error) {
        return res.status(500).send("Renewal failed.");
    }
}