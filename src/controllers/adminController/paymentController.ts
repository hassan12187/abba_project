import { type Request, type Response } from "express";
import paymentModel from "../../models/paymentModel.js";
import redis from "../../services/Redis.js";

export const handleAddPayment = async (req: Request, res: Response) => {
    try {
        const { student_roll_no, totalAmount, paymentMethod } = req.body;
        const payment = new paymentModel({ student_roll_no, totalAmount, paymentMethod });
        const result = await payment.save();

        if (!result) return res.status(400).json({ data: "Error Adding Payment." });

        // Efficient Cache Invalidation: Using SCAN to avoid blocking the event loop
        let cursor = "0";
        do {
            const reply = await redis.scan(cursor, 'MATCH', 'payments*', 'COUNT', 100);
            cursor = reply[0];
            const keys = reply[1];
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== "0");

        return res.status(200).json({ data: "Payment Successful." });
    } catch (error) {
        return res.status(500).json({ data: "Internal Server Error" });
    }
};

export const handleGetAllPayment = async (req: Request, res: Response) => {
    try {
        const result = await paymentModel.find();
        if (result.length <= 0) return res.status(404).json({ data: [] });
        return res.status(200).json({ data: result });
    } catch (error) {
        return res.status(500).json({ data: "Internal Server Error." });
    }
};

export const handleGetPayments = async (req: Request, res: Response) => {
    try {
        // 1. Fix: Removed duplicate 'date' declaration
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 10;
        const query = (req.query.query as string) || "";
        const dateQuery = req.query.date ? Number(req.query.date) : null;

        // 2. Generate Cache Key
        let cachedKey = `payments:p${page}:l${limit}`;
        if (query) cachedKey += `:q:${query}`;
        if (dateQuery) cachedKey += `:d:${new Date(dateQuery).toISOString().split('T')[0]}`;

        const cachedPageData = await redis.get(cachedKey);
        if (cachedPageData) {
            return res.status(200).json({ data: JSON.parse(cachedPageData), cached: true });
        }

        // 3. Build MongoDB Filter
        // Using 'any' for the filter object to handle MongoDB's complex query operators easily
        let filterQuery: any = {};

        if (query) {
            filterQuery.student_registration_no = { $regex: query, $options: "i" };
        }

        if (dateQuery) {
            const startOfTheDay = new Date(dateQuery).setHours(0, 0, 0, 0);
            const endOfTheDay = new Date(dateQuery).setHours(23, 59, 59, 999);
            filterQuery.paymentDate = { $gte: new Date(startOfTheDay), $lte: new Date(endOfTheDay) };
        }

        const payments = await paymentModel.find(filterQuery)
            .skip(limit * page)
            .limit(limit)
            .sort({ createdAt: -1 });

        if (payments.length === 0) {
            return res.status(200).json({ data: [] }); // 204 doesn't return a body, 200 is safer for JSON
        }

        // 4. Cache the result for 1 hour (3600 seconds)
        await redis.setex(cachedKey, 3600, JSON.stringify(payments));

        return res.status(200).json({ data: payments });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ data: "Internal Server Error." });
    }
};