import FeeInvoiceModel from "../../models/FeeInvoice.js";

export const getAllFeeInvoice=async(req,res)=>{
    try {
        const allInvoices = await FeeInvoiceModel.find();
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const addInvoice=async(req,res)=>{
try {
    const {student_id,room_id,billingMonth,totalAmount,}=req.body;
} catch (error) {
    return res.sendStatus(500);
}
};