import paymentModel from "../../models/paymentModel.js";
import redis from "../services/Redis.js";

export const handleAddPayment=async(req,res)=>{
    try {
        const {student_registration_no,amount,payment_method}=req.body;
        const payment = new paymentModel({student_registration_no,amount,payment_method});
        const result = await payment.save();
        if(!result)return res.status(400).json({data:"Error Adding Payment."});
        let cursor="0";
        do {
            const reply = await redis.scan(cursor,'MATCH','payments*','COUNT',100);
            console.log("reply ",reply);
            cursor=reply[0];
            const keys =reply[1];
            if(keys.length > 0){
                await redis.del(...keys);
            }
        } while (cursor !=="0");
        const keys =await redis.keys("payments*");
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
        const {page=0,limit=10,query,date}=req.query;
        let cachedKey=`payments:${page}`;
        if(query)cachedKey+=`:query:${query}`;
        if(date) cachedKey+=`:date:${new Date(date).toLocaleDateString()}` 
        const cachedPageData = await redis.get(cachedKey);
        if(cachedPageData){
            return res.status(200).json({data:JSON.parse(cachedPageData),cached:true});
        };
        let filterQuery={};
        if(query)filterQuery.student_registration_no={$regex:query,$options:"i"};
        if(date){
            const startOfTheDay=new Date(date).setHours(0,0,0,0);
            const endOfTheDay=new Date(date).setHours(23,59,59,999);
            filterQuery.date={$gte:startOfTheDay,$lte:endOfTheDay};
        };
        const payments=await paymentModel.find(filterQuery).skip(limit*page).limit(limit);
        if(payments.length <=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(payments));
        return res.status(200).json({data:payments});  
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error."});
    }
}