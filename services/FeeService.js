import FeeInvoiceModel from "../models/FeeInvoice.js";
import FeeTemplate from "../models/FeeTemplate.js";
import studentApplicationModel from "../models/studentApplicationModel.js";


const getMonthStartEnd=(year,month)=>{
    const start=new Date(year,month-1,1);
    const end = new Date(year,month,0);
    return {start,end};
}

export const generateMonthlyFees=async(year,month,generatedBy="AUTO")=>{
    const billingMonth=`${year}-${String(month).padStart(2,"0")}`;
    const {start:monthStart,end:monthEnd}=getMonthStartEnd(year,month);
    const students=await studentApplicationModel.find({
        isActive:true,
        status:"approved"
    }).populate("room_id");
    for(const student of students){
        if(
            (student.hostelJoinDate && student.hostelJoinDate > monthEnd) ||
            (student.hostelLeaveDate && student.hostelLeaveDate < monthStart)
        ){
            continue;
        }
        const exists = await FeeInvoiceModel.findOne({
            student_id:student._id,
            billingMonth
        });
        if(exists)continue;
        const lineItems=[];
        if(student.room_id){
            const roomTemplate=await FeeTemplate.findOne({
                category:"Room",
                frequency:"Monthly",
                roomType:student.room_id.type
            });
            if(roomTemplate){
                roomTemplate.lineItems.forEach(item=>{
                    lineItems.push({
                        description:`${item.description} (${billingMonth})`,
                        amount:item.amount
                    })
                })
            }
        };
        if(!lineItems.length)continue;
        const totalAmount = lineItems.reduce((sum,li)=>sum+li.amount,0);
        await FeeInvoiceModel.create({
            student_id:student._id,
            room_id:student.room_id?._id,
            invoiceNumber:`INV-${billingMonth}-${student._id.toString().slice(-5)}`,
            billingMonth,
            billingYear:year,
            lineItems,
            totalAmount,
            totalPaid:0,
            status:"Pending",
            generatedBy,
            dueDate:new Date(year,month-1,10)
        })
    }
};