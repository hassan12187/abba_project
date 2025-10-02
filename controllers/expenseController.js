import expenseModel from "../models/expenseModel.js";
export const getAllExpense=async(req,res)=>{
    try {
        const {page,limit}=req.query;
        const result = await expenseModel.find().skip(limit*page).limit(limit);
        if(result.length <=0)return res.send({status:400,data:[]});
        return res.send({status:200,data:result});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
};
export const addExpense=async(req,res)=>{
    try {
        const {expense_type,description,amount}=req.body;
        const result = await expenseModel.insertOne({expense_type,description,amount});
        if(!result) return res.send({status:400,data:"Error Inserting Expense."});
        return res.send({status:200,data:"Expense Successfully Inserted.",expense:result});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
};
export const editExpense=async(req,res)=>{
    try {
        const result = await expenseModel.find();
        if(result.length <=0)return res.send({status:400,data:"No Expense Found."});
        return res.send({status:200,data:result});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
};