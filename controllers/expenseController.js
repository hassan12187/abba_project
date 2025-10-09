import expenseModel from "../models/expenseModel.js";
import redis from "../services/Redis.js";

export const getAllExpense=async(req,res)=>{
    try {
        const {page,limit,query,date}=req.query;
        console.log(page,limit,query,date);
        let cachedKey=`expenses:${page}`;
        if(query && query?.trim()!== "")cachedKey+=`:query:${query}`;
        if(date)cachedKey+=`:date:${date}`;
        
        const expenseDataFromCache = await redis.get(cachedKey);
        if(expenseDataFromCache)return res.status(200).json({data:JSON.parse(expenseDataFromCache)});
        let filterKey={};
        if(query && query.trim()!=="")filterKey.expense_type={$regex:query,$options:'i'};
        if(date){
            const startOfTheDay=new Date(date);
            startOfTheDay.setHours(0,0,0,0);
            const endOfTheDay=new Date(date);
            endOfTheDay.setHours(23,59,59,999);
            filterKey.date={$gte:startOfTheDay,$lte:endOfTheDay};
        }
        const result = await expenseModel.find(filterKey).skip(limit*page).limit(limit);
        if(result.length <=0)return res.status(204).json({data:[]});
        await redis.setex(cachedKey,3600,JSON.stringify(result));
        console.log("expense data from DB");
        return res.status(200).json({data:result});
    } catch (error) {
        console.log('error is ',error);
        return res.status(500).json({data:"Internal Server Error."});
    }
};
export const addExpense=async(req,res)=>{
    try {
        const {expense_type,description,amount}=req.body;
        const result = await expenseModel.insertOne({expense_type,description,amount});
        if(!result) return res.status(400).json({data:"Error Inserting Expense."});
        let cursor = "0";
        do {
            const reply = await redis.scan(cursor,'MATCH','expenses*','COUNT',100);
            cursor = reply[0];
            const keys = reply[1];
            if(keys.length >0){
                await redis.del(...keys);
            }
        } while (cursor !== "0");
        // const keys = await redis.keys('expenses*');
        // if(keys.length>0)await redis.del(keys);
        return res.status(200).json({data:"Expense Successfully Inserted.",expense:result});
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error."});
    }
};
export const editExpense=async(req,res)=>{
    try {
        const result = await expenseModel.find();
        if(result.length <=0)return res.status(204).json({data:"No Expense Found."});
        return res.status(200).json({data:result});
    } catch (error) {
        return res.sttus(500).json({data:"Internal Server Error."});
    }
};