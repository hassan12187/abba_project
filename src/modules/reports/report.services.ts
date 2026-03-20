import Report      from "./reportModel.js"
import ExpenseModel from "../expense/expenseModel.js"
import FeeInvoiceModel from "../feeInvoice/FeeInvoice.js"
import studentApplicationModel from "../student.application/studentApplicationModel.js"
import { HttpError } from "../../utils/errors.js"

// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0);   return r }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r }

function startOfMonth(y: number, m: number) { return new Date(y, m, 1) }
function endOfMonth(y: number, m: number)   { return new Date(y, m + 1, 0, 23, 59, 59, 999) }

/** Build a date range from the request filters */
function buildDateRange(filters: ReportFilters): { from: Date; to: Date } {
  if (filters.fromDate && filters.toDate) {
    return {
      from: startOfDay(new Date(filters.fromDate)),
      to:   endOfDay(new Date(filters.toDate)),
    }
  }
  if (filters.month) {
    const [year, month] = filters.month.split("-").map(Number)
    return {
      from: startOfMonth(year, month - 1),
      to:   endOfMonth(year, month - 1),
    }
  }
  // Default: current month
  const now = new Date()
  return {
    from: startOfMonth(now.getFullYear(), now.getMonth()),
    to:   endOfMonth(now.getFullYear(), now.getMonth()),
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReportFilters {
  month?:    string   // "YYYY-MM"
  fromDate?: string   // ISO date string
  toDate?:   string   // ISO date string
}

export interface CreateExpenseDTO {
  description: string
  amount:      number
  category:    string
  date?:       string
  note?:       string
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const ReportService = {

  // ── Main report endpoint ────────────────────────────────────────────────────
  /**
   * Returns summary cards, trend chart (last 6 months), expense pie,
   * and paginated recent transactions — all filtered by date range.
   */
  async getReport(filters: ReportFilters) {
    const { from, to } = buildDateRange(filters)

    // Run all aggregations in parallel
    const [
      paymentStats,
      expenseStats,
      expensePie,
      recentPayments,
      recentExpenses,
      studentCount,
      trendData,
    ] = await Promise.all([

      // Total payments collected in range (from FeeInvoice)
      FeeInvoiceModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id:          null,
            total:        { $sum: "$totalPaid" },
            count:        { $sum: 1 },
            outstanding:  { $sum: "$balanceDue" },
            overdue:      { $sum: { $cond: [{ $eq: ["$status","Overdue"] }, 1, 0] } },
          },
        },
      ]),

      // Total expenses in range
      ExpenseModel.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      // Expense breakdown by category (for pie chart)
      ExpenseModel.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        { $group: { _id: "$category", amount: { $sum: "$amount" } } },
        { $sort: { amount: -1 } },
        { $project: { _id: 0, category: "$_id", amount: 1 } },
      ]),

      // Recent payment records
      FeeInvoiceModel.find(
        { createdAt: { $gte: from, $lte: to } },
        { invoiceNumber:1, student_name:1, totalPaid:1, createdAt:1, generatedBy:1 }
      )
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // Recent expense records
      ExpenseModel.find({ date: { $gte: from, $lte: to } })
        .sort({ date: -1 })
        .limit(10)
        .lean(),

      // Total enrolled students
      studentApplicationModel.countDocuments({ status: { $in: ["approved","accepted"] } }),

      // Trend: last 6 months — uses the Report snapshots for speed
      Report.aggregate([
        {
          $match: {
            reportDate: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 5)),
              $lte: new Date(),
            },
          },
        },
        {
          $group: {
            _id: {
              year:  { $year:  "$reportDate" },
              month: { $month: "$reportDate" },
            },
            Income:  { $sum: "$total_payments" },
            Expense: { $sum: "$total_expenses" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            _id:  0,
            name: {
              $dateToString: {
                format: "%b %Y",
                date: {
                  $dateFromParts: { year: "$_id.year", month: "$_id.month", day: 1 },
                },
              },
            },
            Income:  1,
            Expense: 1,
          },
        },
      ]),
    ])

    const totalPayments = paymentStats[0]?.total        ?? 0
    const totalExpenses = expenseStats[0]?.total        ?? 0
    const outstanding   = paymentStats[0]?.outstanding  ?? 0
    const netBalance    = totalPayments - totalExpenses

    return {
      summaryCard: {
        total_enrolled_students: studentCount,
        total_payments_period:   Math.round(totalPayments * 100) / 100,
        total_expenses_period:   Math.round(totalExpenses * 100) / 100,
        net_balance:             Math.round(netBalance    * 100) / 100,
        total_outstanding:       Math.round(outstanding   * 100) / 100,
        overdue_invoices:        paymentStats[0]?.overdue ?? 0,
      },
      charts: {
        trendChart:      trendData,
        expensePieChart: expensePie,
      },
      recentActivity: {
        payments: recentPayments.map((p) => ({
          _id:           p._id,
          student_name:  p.student_name,
          invoiceNumber: p.invoiceNumber,
          totalAmount:   p.totalPaid,
          paymentDate:   p.createdAt,
          paymentMethod: p.generatedBy ?? "Manual",
        })),
        expenses: recentExpenses.map((e) => ({
          _id:          e._id,
          description:  e.description,
          amount:       e.amount,
          date:         e.date,
          expense_type: e.category,
          note:         e.note,
        })),
      },
      dateRange: { from: from.toISOString(), to: to.toISOString() },
    }
  },

  // ── Snapshot generator ──────────────────────────────────────────────────────
  /**
   * Generates (or updates) a Report snapshot for a given date.
   * Call this:
   *   - via a daily cron job at midnight
   *   - after recording a new expense
   *   - after a payment is processed
   * This keeps the trend chart data fresh without expensive on-demand aggregations.
   */
  async generateDailySnapshot(date: Date = new Date()) {
    const from = startOfDay(date)
    const to   = endOfDay(date)

    const [payments, expenses, students] = await Promise.all([
      FeeInvoiceModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, total: { $sum: "$totalPaid" } } },
      ]),
      ExpenseModel.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        {
          $group: {
            _id:             "$category",
            amount:          { $sum: "$amount" },
          },
        },
      ]),
      studentApplicationModel.countDocuments({ status: { $in: ["approved","accepted"] } }),
    ])

    const totalPayments = payments[0]?.total ?? 0
    const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0)

    // Upsert — one snapshot per day
    const snapshot = await Report.findOneAndUpdate(
      { reportDate: from },
      {
        $set: {
          total_payments:    Math.round(totalPayments * 100) / 100,
          total_expenses:    Math.round(totalExpenses * 100) / 100,
          net_profit:        Math.round((totalPayments - totalExpenses) * 100) / 100,
          total_students:    students,
          expense_breakdown: expenses.map((e: any) => ({
            category: e._id,
            amount:   Math.round(e.amount * 100) / 100,
          })),
        },
      },
      { upsert: true, new: true }
    )

    return snapshot
  },

  // ── Expenses CRUD ───────────────────────────────────────────────────────────

  async getAllExpenses(filters: {
    category?: string
    from?:     string
    to?:       string
    page?:     number
    limit?:    number
  }) {
    const query: any = {}
    if (filters.category) query.category = filters.category
    if (filters.from || filters.to) {
      query.date = {}
      if (filters.from) query.date.$gte = startOfDay(new Date(filters.from))
      if (filters.to)   query.date.$lte = endOfDay(new Date(filters.to))
    }

    const page  = filters.page  ?? 1
    const limit = filters.limit ?? 20
    const skip  = (page - 1) * limit

    const [data, total] = await Promise.all([
      ExpenseModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      ExpenseModel.countDocuments(query),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  },

  async createExpense(dto: CreateExpenseDTO) {
    const expense = await ExpenseModel.create({
      ...dto,
      amount: Math.round(dto.amount * 100) / 100,
      date:   dto.date ? new Date(dto.date) : new Date(),
    })
    // Regenerate today's snapshot after adding an expense
    await ReportService.generateDailySnapshot(expense.date)
    return expense
  },

  async updateExpense(id: string, dto: Partial<CreateExpenseDTO>) {
    const expense = await ExpenseModel.findByIdAndUpdate(
      id,
      { $set: { ...dto, amount: dto.amount ? Math.round(dto.amount * 100) / 100 : undefined } },
      { new: true, runValidators: true }
    )
    if (!expense) throw HttpError.notFound(`Expense ${id} not found`)
    await ReportService.generateDailySnapshot(expense.date)
    return expense
  },

  async deleteExpense(id: string) {
    const expense = await ExpenseModel.findByIdAndDelete(id)
    if (!expense) throw HttpError.notFound(`Expense ${id} not found`)
    await ReportService.generateDailySnapshot(expense.date)
  },
}