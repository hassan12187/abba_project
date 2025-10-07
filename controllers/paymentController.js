import paymentModel from "../models/paymentModel.js";
import redis from "../services/Redis.js";

export const handleAddPayment=async(req,res)=>{
    try {
        const {student_registration_no,amount,payment_method}=req.body;
        const payment = new paymentModel({student_registration_no,amount,payment_method});
        const result = await payment.save();
        if(!result)return res.status(400).json({data:"Error Adding Payment."});
        const keys =await redis.keys("payment:*");
        if(keys.length>0)await redis.del(keys);
        return res.status(200).json({data:"Payment Successfull."});
    } catch (error) {
       return res.status(500).json({data:"Internal Server Error"}); 
    }
};
export const handleGetAllPayment=async(req,res)=>{
    try {
        const result = await paymentModel.find();
        if(result.length <= 0)return res.status(404).json({data:[]});
        return res.status(200).json({data:result});
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error."});
    }
};
export const handleGetPayments=async(req,res)=>{
    try {
        const {page=0,limit=10,query=""}=req.query;
        console.log(query);
        const cachedKey=query ? `payment:${page}:query:${query}` : `payment:${page}`;
        const cachedPageData = await redis.get(cachedKey);
        console.log(cachedPageData);
        if(cachedPageData){
            return res.status(200).json({data:JSON.parse(cachedPageData),cached:true});
        };
        const filterQuery=query ? {student_registration_no:{$regex:query,$options:'i'}} : {};
        const payments=await paymentModel.find(filterQuery).skip(limit*page).limit(limit);
        if(payments.length <=0)return res.status(404).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(payments));
        return res.status(200).json({data:payments});  
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error."});
    }
}