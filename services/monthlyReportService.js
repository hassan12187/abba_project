import expenseModel from "../models/expenseModel.js";
import paymentModel from "../models/paymentModel.js";
import reportModel from "../models/reportModel.js";

export const handleGenerateMontlyReport=async()=>{
       const now = new Date();
    const startOfLastMonth=new Date(now.getFullYear(),now.getMonth()-1,1);
    const endOfLastMonth=new Date(now.getFullYear(),now.getMonth(),0,23,59,59);
    const total_expenses = await expenseModel.aggregate([
        {$match:{date:{$gte:startOfLastMonth,$lte:endOfLastMonth }}},
        {$group:{_id:null,total_expense:{$sum:'$amount'}}}
    ]);
    const total_payments=await paymentModel.aggregate([
        {$match:{date:{$gte:startOfLastMonth,$lte:endOfLastMonth}}},
        {$group:{_id:null,total_payment:{$sum:'$amount'}}}
    ]);
    const result = new reportModel({total_expenses:total_expenses[0]?.total_expense,total_payments:total_payments[0]?.total_payment});
   await result.save();
};