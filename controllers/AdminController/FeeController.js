import FeeInvoiceModel from "../../models/FeeInvoice.js";
import FeeTemplate from "../../models/FeeTemplate.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";
import Counter from "../../models/Counter.js";
import redis from "../../services/Redis.js";

export const getFeeInvoice=async(req,res)=>{
    try {
        const limit = parseInt(req.query.limit)||10;
        const page = parseInt(req.query.page)||1;
        const skip = (page-1)*limit;
        const invoices = await FeeInvoiceModel.aggregate([
            {
                $lookup:{
                    from:"student_applications",
                    localField:"student_id",
                    foreignField:"_id",
                    as:"student"
                }
            },
            {
                $unwind:{
                    path:"$student",
                    preserveNullAndEmptyArrays:false
                }
            },
            {
                $lookup:{
                    from:"rooms",
                    localField:"room_id",
                    foreignField:"_id",
                    as:"room"
                }
            },
            {
                $unwind:{
                    path:"$room",
                    preserveNullAndEmptyArrays:true
                },
            },
            {
                $project:{
                    invoiceNumber:1,
                    totalAmount:1,
                    totalPaid:1,
                    balanceDue:1,
                    billingMonth:1,
                    status:1,
                    dueDate:1,
                    student_name:"$student.student_name",
                    student_id:"$student._id",
                    room_no:"$room.room_no",
                    room_id:"$room._id",
                    createdAt:1
                }
            },
            {$sort:{createdAt:-1}},
            {$skip:skip},
            {$limit:limit}
        ]);
        return res.status(200).send(invoices);
    } catch (error) {
        return res.sendStatus(500);
    }
};
export const handleCreateInvoice=async(req,res)=>{
    try {
        const {student_id,billingMonth,dueDate,lineItems,room_id}=req.body;
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
            room_id,
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
        const student = await studentApplicationModel.findOne({student_roll_no:q},'student_name student_roll_no').populate("room_id","room_no").lean();
        if(!student)return res.status(404).json({message:"Student Not Found."});
        const studentDto = {
            student_id:student?._id,
            student_name:student?.student_name,
            student_roll_no:student?.student_roll_no,
            room_id:student?.room_id._id,
            room_no:student?.room_id?.room_no
        };
        console.log(studentDto);
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