import { Request, Response, NextFunction } from "express"
import { Router }         from "express"
import { ReportService }  from "./report.services.js"
import { validate }       from "../../middleware/validate.middleware.js"
import {
  reportFiltersSchema, createExpenseSchema, updateExpenseSchema,
  expenseFiltersSchema, idParamSchema, snapshotSchema,
} from "./report.validation.js"
import { getDashboard } from "../dashboard/dashboard.routes.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Report controllers ───────────────────────────────────────────────────────

/** GET /report — main report with filters */
const getReport = asyncHandler(async (req, res) => {
  const { month, fromDate, toDate } = req.query as any
  const data = await ReportService.getReport({ month, fromDate, toDate })
  res.status(200).json({ success: true, data })
})

/** POST /report/snapshot — manually trigger a daily snapshot */
const generateSnapshot = asyncHandler(async (req, res) => {
  const date = req.body.date ? new Date(req.body.date) : new Date()
  const snap  = await ReportService.generateDailySnapshot(date)
  res.status(200).json({ success: true, message: "Snapshot generated.", data: snap })
})

// ─── Expense controllers ──────────────────────────────────────────────────────

/** GET /report/expenses */
const getExpenses = asyncHandler(async (req, res) => {
  const { category, from, to, page, limit } = req.query as any
  const data = await ReportService.getAllExpenses({ category, from, to, page: Number(page), limit: Number(limit) })
  res.status(200).json({ success: true, ...data })
})

/** POST /report/expenses */
const createExpense = asyncHandler(async (req, res) => {
  const expense = await ReportService.createExpense(req.body)
  res.status(201).json({ success: true, message: "Expense recorded.", data: expense })
})

/** PATCH /report/expenses/:id */
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await ReportService.updateExpense(req.params.id, req.body)
  res.status(200).json({ success: true, message: "Expense updated.", data: expense })
})

/** DELETE /report/expenses/:id */
const deleteExpense = asyncHandler(async (req, res) => {
  await ReportService.deleteExpense(req.params.id)
  res.status(200).json({ success: true, message: "Expense deleted." })
})

// ─── Router ───────────────────────────────────────────────────────────────────
// Mount as:  app.use("/api/admin/report", reportRouter)

export const reportRouter = Router()

// Main report
reportRouter.get   ("/",         validate(reportFiltersSchema), getReport)
reportRouter.post  ("/snapshot", validate(snapshotSchema),      generateSnapshot)
reportRouter.get('/home-dashboard',getDashboard);

// Expenses sub-resource
reportRouter.get   ("/expenses",     validate(expenseFiltersSchema), getExpenses)
reportRouter.post  ("/expenses",     validate(createExpenseSchema),  createExpense)
reportRouter.patch ("/expenses/:id", validate(updateExpenseSchema),  updateExpense)
reportRouter.delete("/expenses/:id", validate(idParamSchema),        deleteExpense)