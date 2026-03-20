import { type Request, type Response } from "express";
import expenseModel from "../../modules/expense/expenseModel.js";
import Payment from "../../modules/payment/payment.model.js";
import Report from "../../models/reportModel.js";
import roomModel from "../../modules/hostel/room.model.js";
import studentApplicationModel from "../../modules/student.application/studentApplicationModel.js";

// Helper for cleaner date resets
const startOfDay = (d: Date) => new Date(d.setHours(0, 0, 0, 0));
const endOfDay = (d: Date) => new Date(d.setHours(23, 59, 59, 999));

export const handleGetReport = async (req: Request, res: Response) => {
    try {
        const { from_date, to_date } = req.headers;
        let fromDate: Date = new Date();
        let toDate: Date = new Date();

        if (from_date && to_date) {
            fromDate = startOfDay(new Date(from_date as string));
            toDate = endOfDay(new Date(to_date as string));
        } else if (from_date && !to_date) {
            fromDate = startOfDay(new Date(from_date as string));
            // Default to end of that specific month
            toDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0, 23, 59, 59);
        } else if (!from_date && to_date) {
            toDate = endOfDay(new Date(to_date as string));
            fromDate = new Date(toDate.getFullYear(), toDate.getMonth(), 1, 0, 0, 0);
        }

        const reports = await Report.find({ 
            date: { $gte: fromDate, $lte: toDate } 
        });

        return res.status(200).json({ status: 200, data: "All Reports.", reports });
    } catch (error) {
        return res.status(500).json({ status: 500, data: "Internal Server Error." });
    }
};

export const getHomeDashboardStats = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [totalStudents, occupiedRooms, paymentsDone, pendingApplications] = await Promise.all([
            studentApplicationModel.countDocuments({ status: { $in: ["accepted", "approved", "pending"] } }),
            roomModel.countDocuments({ status: "occupied" }),
            Payment.countDocuments({ paymentDate: { $gte: start, $lte: end } }),
            studentApplicationModel.countDocuments({ status: "pending" })
        ]);

        return res.status(200).json({
            totalStudents: totalStudents || 0,
            occupiedRooms: occupiedRooms || 0,
            paymentsDone: paymentsDone || 0,
            pendingApplications: pendingApplications || 0
        });
    } catch (error) {
        return res.sendStatus(500);
    }
};

interface AggregatedMonth {
    _id: { month: number; year: number };
    income: number;
    expense: number;
    daily_breakdowns: Array<Array<{ category: string; amount: number }>>;
}

export const getReportDashboardStats = async (req: Request, res: Response) => {
    const sixMonthAgo = new Date();
    sixMonthAgo.setMonth(sixMonthAgo.getMonth() - 6);
    sixMonthAgo.setDate(1);
    sixMonthAgo.setHours(0, 0, 0, 0);

    try {
        const [reportsList, currentStudentCount, recentPayments, recentExpenses] = await Promise.all([
            Report.aggregate<AggregatedMonth>([
                { $match: { reportDate: { $gt: sixMonthAgo } } },
                {
                    $group: {
                        _id: {
                            month: { $month: "$reportDate" },
                            year: { $year: "$reportDate" }
                        },
                        income: { $sum: "$total_payments" },
                        expense: { $sum: "$total_expenses" },
                        daily_breakdowns: { $push: "$expense_breakdown" }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            studentApplicationModel.countDocuments({ status: { $in: ["accepted", "approved"] } }),
            Payment.find().sort({ createdAt: -1 }).limit(5),
            expenseModel.find().sort({ createdAt: -1 }).limit(5)
        ]);

        let totalIncomePeriod = 0;
        let totalExpensePeriod = 0;
        const categoryTotals: Record<string, number> = {};

        const trendData = reportsList.map(monthData => {
            totalIncomePeriod += monthData.income;
            totalExpensePeriod += monthData.expense;

            // Flatten and accumulate categories
            monthData.daily_breakdowns.flat().forEach(item => {
                if (item && item.category) {
                    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
                }
            });

            const date = new Date(monthData._id.year, monthData._id.month - 1, 1);
            const monthName = date.toLocaleString('default', { month: 'short' });

            return {
                name: `${monthName} ${monthData._id.year}`,
                Income: monthData.income,
                Expense: monthData.expense,
                profit: monthData.income - monthData.expense
            };
        });

        const pieChartCategoryData = Object.entries(categoryTotals).map(([category, amount]) => ({
            category,
            amount
        }));

        return res.status(200).json({
            summaryCard: {
                total_enrolled_students: currentStudentCount,
                total_payments_period: totalIncomePeriod,
                total_expenses_period: totalExpensePeriod
            },
            charts: {
                trendChart: trendData,
                expensePieChart: pieChartCategoryData
            },
            recentActivity: {
                payments: recentPayments,
                expenses: recentExpenses,
            }
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return res.sendStatus(500);
    }
};