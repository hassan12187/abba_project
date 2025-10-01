import paymentModel from "../models/paymentModel.js";

export const handleAddPayment=async(req,res)=>{
    try {
        const {student_registration_no,amount,payment_method}=req.body;
        const payment = new paymentModel({student_registration_no,amount,payment_method});
        const result = await payment.save();
        if(result && result._id)return res.send({status:200,data:"Payment Successfull.",payment:result});
        return res.send({status:400,data:"Error Adding Payment."});
    } catch (error) {
       return res.send({status:500,data:"Internal Server Error"}); 
    }
};
export const handleGetAllPayment=async(req,res)=>{
    try {
        const result = await paymentModel.find();
        if(result.length <= 0)return res.send({status:400,data:"No Payment Record Found.",payment:[]});
        return res.send({status:200,data:"Payment Records.",payment:result});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
};
export const handleGetPayments=async(req,res)=>{
    try {
        const {page,limit}=req.query;
        const payments=await paymentModel.find().skip(limit*page).limit(limit);
        if(payments.length <=0)return res.send({status:300,data:"No Payments Found",payments});
        return res.send({status:200,data:"All Records.",payments});  
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
}