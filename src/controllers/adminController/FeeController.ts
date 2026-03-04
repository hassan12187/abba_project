import { type Request,type Response } from "express";
import mongoose, { startSession } from "mongoose";
import FeeInvoiceModel from "../../models/FeeInvoice.js";
import FeeTemplate from "../../models/FeeTemplate.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";
import Counter from "../../models/Counter.js";
import redis from "../../services/Redis.js";
import Payment from "../../models/paymentModel.js";

export const getFeeInvoice = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const page = parseInt(req.query.page as string) || 1;
        const skip = (page - 1) * limit;

        const invoices = await FeeInvoiceModel.aggregate([
            {
                $lookup: {
                    from: "student_applications",
                    localField: "student_id",
                    foreignField: "_id",
                    as: "student"
                }
            },
            {
                $unwind: {
                    path: "$student",
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $lookup: {
                    from: "rooms",
                    localField: "room_id",
                    foreignField: "_id",
                    as: "room"
                }
            },
            {
                $unwind: {
                    path: "$room",
                    preserveNullAndEmptyArrays: true
                },
            },
            {
                $project: {
                    invoiceNumber: 1,
                    totalAmount: 1,
                    totalPaid: 1,
                    balanceDue: 1,
                    billingMonth: 1,
                    status: 1,
                    dueDate: 1,
                    student_name: "$student.student_name",
                    student_id: "$student._id",
                    room_no: "$room.room_no",
                    room_id: "$room._id",
                    createdAt: 1
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        return res.status(200).json(invoices);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
};

export const handleCreateInvoice = async (req: Request, res: Response) => {
    try {
        const { student_id, billingMonth, dueDate, lineItems, room_id } = req.body;

        // Atomic sequence increment
        const counter = await Counter.findOneAndUpdate(
            { id: "invoice_id" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        if (!counter) throw new Error("Counter sequence failed to generate.");

        const currentYear = new Date().getFullYear();
        const invoiceNumber = `INV-${currentYear}-${counter.seq.toString().padStart(4, '0')}`;

        const totalAmount = lineItems.reduce((acc: number, item: any) => acc + (item.amount || 0), 0);

        const newInvoice = await FeeInvoiceModel.create({
            invoiceNumber,
            student_id,
            room_id,
            billingMonth,
            dueDate,
            lineItems,
            totalAmount,
            totalPaid: 0,
            balanceDue: totalAmount
        });

        return res.status(201).json(newInvoice);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
};

export const getSpecificStudent = async (req: Request, res: Response) => {
    try {
        const { q } = req.query;
        // Search by roll no (assuming it's stored as a string or number)
        const student: any = await studentApplicationModel.findOne({ student_roll_no: q }, 'student_name student_roll_no')
            .populate("room_id", "room_no")
            .lean();

        if (!student) return res.status(404).json({ message: "Student Not Found." });

        const studentDto = {
            student_id: student._id,
            student_name: student.student_name,
            student_roll_no: student.student_roll_no,
            room_id: student.room_id?._id || null,
            room_no: student.room_id?.room_no || "N/A"
        };

        return res.status(200).json(studentDto);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
};
export const addInvoicePayment = async (req: Request, res: Response) => {
    const session = await startSession();
    try {
        session.startTransaction();
        const { invoiceId } = req.params;
        const { amount, paymentMethod } = req.body;

        const result = await FeeInvoiceModel.findById(invoiceId).session(session);
        
        if (!result) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Invoice not Found." });
        }

        // Logic check using existing concrete fields
        if ((result.totalPaid + amount) > result.totalAmount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Payment exceeds balance." });
        }

        // 1. Update the concrete field
        result.totalPaid += amount;
        
        // 2. Update status based on the math (since you can't read the virtual mid-transaction easily)
        if (result.totalPaid >= result.totalAmount) {
            result.status = "Paid";
        }

        const paymentRecord = new Payment({
            student: result.student_id,
            paymentMethod,
            amount: amount, 
            invoices: [
                { invoiceId: result._id, amountApplied: amount }
            ]
        });

        // 3. Save documents
        await paymentRecord.save({ session });
        await result.save({ session });

        await session.commitTransaction();
        
        // The returned JSON will include the virtual 'balanceDue' if your schema is set to toJSON: { virtuals: true }
        return res.status(200).json({ 
            message: "Payment Successful.",
            totalPaid: result.totalPaid,
            status: result.status 
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Payment Error:", error);
        return res.sendStatus(500);
    } finally {
        await session.endSession();
    }
};
export const getFeeTemplates = async (req: Request, res: Response) => {
    try {
        const redisCachedFeeTemplate = await redis.get('templates');
        if (redisCachedFeeTemplate) {
            return res.status(200).json(JSON.parse(redisCachedFeeTemplate));
        }

        const templates = await FeeTemplate.find({}, 'name description frequency category roomType totalAmount');
        
        if (templates.length === 0) return res.status(404).json({ message: "No templates found" });

        await redis.set("templates", JSON.stringify(templates));
        return res.status(200).json(templates);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
};

export const addFeeTemplate = async (req: Request, res: Response) => {
    try {
        const { name, description, frequency, category, totalAmount, roomType } = req.body;
        
        await FeeTemplate.create({ name, description, frequency, category, totalAmount, roomType });

        // Standard cache invalidation
        let cursor = "0";
        do {
            const reply = await redis.scan(cursor, 'MATCH', 'templates*', 'COUNT', 100);
            cursor = reply[0];
            const keys = reply[1];
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== "0");

        return res.status(201).json({ message: "Template created successfully" });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
};