import FeeInvoiceModel from "../../models/FeeInvoice.js";
import FeeTemplate from "../../models/FeeTemplate.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";
import Counter from "../../models/Counter.js";
import redis from "../../services/Redis.js";

export const getFeeInvoice=async(req,res)=>{
    try {
        const allInvoices = await FeeInvoiceModel.find();
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const handleCreateInvoice=async(req,res)=>{
    try {
        const {student_id,billingMonth,dueDate,lineItems}=req.body;
        const counter=await Counter.findOneAndUpdate(
        { id:"invoice_id"},
        {$inc:{seq:1}},
        {new:true,upsert:true}
    );
        const currentYear=new Date().getFullYear();
        const invoiceNumber= `INV-${currentYear}-${counter.seq.toString().padStart(4,'0')}`;
        const newInvoice = await FeeInvoiceModel.create({
            invoiceNumber,
            student_id,
            billingMonth,
            dueDate,
            lineItems,
            totalAmount:lineItems.reduce((acc,item)=>acc+item.amount,0)
        });
        await newInvoice.save();
        return res.status(201).json(newInvoice);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const getSpecificStudent=async(req,res)=>{
    try {
        const {q}=req.query;
        const student = await studentApplicationModel.findOne({student_roll_no:q},'student_name room_id student_roll_no').populate("room_id","room_no");
        if(!student)return res.status(404).json({message:"Student Not Found."});
        const studentDto = {
            student_id:student?._id,
            student_name:student?.student_name,
            student_roll_no:student?.student_roll_no,
            room_id:student?.room_id,
            room_no:student?.room_id?.room_no
        };
        return res.status(200).json(studentDto);
    } catch (error) {
        console.log(error);
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