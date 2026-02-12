import FeeInvoiceModel from "../../models/FeeInvoice.js";
import FeeTemplate from "../../models/FeeTemplate.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";
import redis from "../../services/Redis.js";

export const getAllFeeInvoice=async(req,res)=>{
    try {
        const allInvoices = await FeeInvoiceModel.find();
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getStudent=async()=>{
    try {
        const {student_roll_no}=req.body;
        const student = await studentApplicationModel.findOne({student_roll_no},'student_name room_id student_roll_no');
        if(!student)return res.status(401).json({message:"Student Not Found."});
        return res.status(200).json({data:student});
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const addInvoice=async(req,res)=>{
try {
    const {student_roll_no,room_no,billingMonth,feeTemplate,totalAmount}=req.body;
    await studentApplicationModel.findOne({student_roll_no});
} catch (error) {
    return res.sendStatus(500);
}
};
export const getFeeTemplates=async(req,res)=>{
try {
    const redisCachedFeeTemplate=await redis.get('templates');
    if(redisCachedFeeTemplate){
        return res.status(200).send(JSON.parse(redisCachedFeeTemplate));
    }
    const templates=await FeeTemplate.find({},'name frequency category roomType totalAmount');
    if(templates.length==0)return res.sendStatus(404);
    await redis.set("templates",JSON.stringify(templates));
    return res.status(200).send(templates);
} catch (error) {
    return res.sendStatus(500);
}
};
export const addFeeTemplate=async(req,res)=>{
    try {
        const {name,description,frequency,category,totalAmount,roomType}=req.body;
        const feetemplate=await FeeTemplate.create({name,description,frequency,category,totalAmount,roomType});
        let cursor = "0";
        do{
            const reply = await redis.scan(cursor,'MATCH','templates*','COUNT',100);
            cursor=reply[0];
            const keys = reply[1];
            if(keys.length>0){
                await redis.del(...keys);
            }
        }while(cursor!=="0");
        return res.sendStatus(200);
    } catch (error) {
        return res.sendStatus(500);
    }
};