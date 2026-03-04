import FeeInvoiceModel from "../models/FeeInvoice.js";
import FeeTemplate from "../models/FeeTemplate.js";
import studentApplicationModel from "../models/studentApplicationModel.js";


const getMonthStartEnd=(year:number,month:number)=>{
    const start=new Date(year,month-1,1);
    const end = new Date(year,month,0);
    return {start,end};
}

import { Types } from "mongoose";

// Define interfaces for your Models/Documents
interface IFeeLineItem {
  description: string;
  amount: number;
}

export const generateMonthlyFees = async (
  year: number, 
  month: number, 
  generatedBy = "AUTO"
) => {
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
  const { start: monthStart, end: monthEnd } = getMonthStartEnd(year, month);

  // 1. Fetch all active/approved students
  const students = await studentApplicationModel.find({
    isActive: true,
    status: "approved"
  }).populate("room_id");

  // 2. Optimization: Pre-fetch all Room Fee Templates to avoid querying inside the loop
  const templates = await FeeTemplate.find({
    category: "Room",
    frequency: "Monthly"
  });
  
  // Create a map for O(1) lookup: roomType -> template
  const templateMap = new Map(templates.map(t => [t.roomType, t]));

  // 3. Filter students eligible for billing this month
  const eligibleStudents = students.filter(student => {
    const joinDate = student.hostelJoinDate;
    const leaveDate = student.hostelLeaveDate;

    if (joinDate && joinDate > monthEnd) return false;
    if (leaveDate && leaveDate < monthStart) return false;
    return true;
  });

  // 4. Batch check for existing invoices to avoid duplicate creation
  const existingInvoices = await FeeInvoiceModel.find({
    billingMonth,
    student_id: { $in: eligibleStudents.map(s => s._id) }
  }).select("student_id");

  const existingStudentIds = new Set(existingInvoices.map((inv:any) => inv.student_id.toString()));

  // 5. Generate Invoices
  const invoicePromises = eligibleStudents.map(async (student) => {
    // Skip if invoice already exists
    if (existingStudentIds.has(student._id.toString())) return;

    const lineItems: IFeeLineItem[] = [];
    const room = student.room_id as any; // Cast to access populated fields

    if (room?.type) {
      const roomTemplate = templateMap.get(room.type);
      
      if (roomTemplate) {
        roomTemplate.lineItems.forEach((item: IFeeLineItem) => {
          lineItems.push({
            description: `${item.description} (${billingMonth})`,
            amount: item.amount || 0
          });
        });
      }
    }

    if (lineItems.length === 0) return;

    const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0);

    return FeeInvoiceModel.create({
      student_id: student._id,
      room_id: room?._id,
      invoiceNumber: `INV-${billingMonth}-${student._id.toString().slice(-5)}`,
      billingMonth,
      billingYear: year,
      lineItems,
      totalAmount,
      totalPaid: 0,
      status: "Pending",
      generatedBy,
      dueDate: new Date(year, month - 1, 10)
    });
  });

  // Execute all creations in parallel
  await Promise.all(invoicePromises);
};