import expenseModel from "../models/expenseModel.js";
import redis from "../services/Redis.js";

export const getAllExpense=async(req,res)=>{
    try {
        const {page,limit}=req.query;
        const expenseDataFromCache = await redis.get(`expense:${page}`);
        if(expenseDataFromCache && JSON.parse(expenseDataFromCache).length>0)return res.status(200).json({data:JSON.parse(expenseDataFromCache)});
        const result = await expenseModel.find().skip(limit*page).limit(limit);
        if(result.length <=0)return res.status(404).json({data:[]});
        await redis.set(`expense:${page}`,JSON.stringify(result));
        console.log("expense data from DB");
        return res.status(200).json({data:result});
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error."});
    }
};
export const addExpense=async(req,res)=>{
    try {
        const {expense_type,description,amount}=req.body;
        const result = await expenseModel.insertOne({expense_type,description,amount});
        if(!result) return res.status(400).json({data:"Error Inserting Expense."});
        const keys = await redis.keys('expense:*');
        if(keys.length>0)await redis.del(keys);
        console.log("keys ",keys);
        return res.status(200).json({data:"Expense Successfully Inserted.",expense:result});
    } catch (error) {
        return res.status(500).json({data:"Internal Server Error."});
    }
};
export const editExpense=async(req,res)=>{
    try {
        const result = await expenseModel.find();
        if(result.length <=0)return res.status(404).json({data:"No Expense Found."});
        return res.sttus(200).json({data:result});
    } catch (error) {
        return res.sttus(500).json({data:"Internal Server Error."});
    }
};