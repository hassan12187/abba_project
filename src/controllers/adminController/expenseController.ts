import expenseModel from "../../models/expenseModel.js";
import redis from "../../services/Redis.js";
import { type Response, type Request } from "express";

// Define an interface for the filter to prevent property errors
interface ExpenseFilter {
    expense_type?: { $regex: any; $options: string };
    date?: { $gte: Date; $lte: Date };
}

export const getAllExpense = async (req: Request, res: Response) => {
    try {
        // Cast query params to strings/numbers to avoid type mismatches
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 10;
        const query = (req.query.query as string) || "";
        const date = req.query.date as string;

        let cachedKey = `expenses:${page}`;
        if (query.trim() !== "") cachedKey += `:query:${query}`;
        if (date) cachedKey += `:date:${date}`;

        const expenseDataFromCache = await redis.get(cachedKey);
        if (expenseDataFromCache) {
            return res.status(200).json({ data: JSON.parse(expenseDataFromCache) });
        }

        const filterKey: ExpenseFilter = {};

        if (query.trim() !== "") {
            filterKey.expense_type = { $regex: query, $options: 'i' };
        }

        if (date) {
            const startOfTheDay = new Date(date);
            startOfTheDay.setHours(0, 0, 0, 0);
            const endOfTheDay = new Date(date);
            endOfTheDay.setHours(23, 59, 59, 999);
            filterKey.date = { $gte: startOfTheDay, $lte: endOfTheDay };
        }

        const result = await expenseModel.find(filterKey)
            .skip(limit * page)
            .limit(limit)
            .sort({ date: -1 }); // Added sorting by newest first

        if (result.length === 0) return res.status(204).json({ data: [] });

        await redis.setex(cachedKey, 3600, JSON.stringify(result));
        return res.status(200).json({ data: result });
    } catch (error) {
        console.error('error is ', error);
        return res.status(500).json({ data: "Internal Server Error." });
    }
};

export const addExpense = async (req: Request, res: Response) => {
    try {
        const { expense_type, description, amount } = req.body;
        
        // Mongoose uses .create(), not .insertOne()
        const result = await expenseModel.create({ expense_type, description, amount });
        
        if (!result) return res.status(400).json({ data: "Error Inserting Expense." });

        // Invalidate Redis Cache for expenses
        let cursor = "0";
        do {
            const reply = await redis.scan(cursor, 'MATCH', 'expenses*', 'COUNT', 100);
            cursor = reply[0];
            const keys = reply[1];
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== "0");

        return res.status(200).json({ data: "Expense Successfully Inserted.", expense: result });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ data: "Internal Server Error." });
    }
};

export const editExpense = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Fixed logic: Use findByIdAndUpdate for an edit function
        const result = await expenseModel.findByIdAndUpdate(id, updates, { new: true });
        
        if (!result) return res.status(404).json({ data: "No Expense Found to update." });

        // Clear cache after edit
        let cursor = "0";
        do {
            const reply = await redis.scan(cursor, 'MATCH', 'expenses*', 'COUNT', 100);
            cursor = reply[0];
            const keys = reply[1];
            if (keys.length > 0) await redis.del(...keys);
        } while (cursor !== "0");

        return res.status(200).json({ data: "Expense Updated Successfully", result });
    } catch (error) {
        return res.status(500).json({ data: "Internal Server Error." });
    }
};

export const getExpense = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Use lean() to get a plain JS object for easier manipulation
        const expense = await expenseModel.findOne({ _id: id }).lean();
        
        if (!expense) return res.sendStatus(404);

        // Safely format the date
        const date = expense.date ? new Date(expense.date).toISOString().split("T")[0] : "";
        
        return res.status(200).json({ ...expense, date });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
};