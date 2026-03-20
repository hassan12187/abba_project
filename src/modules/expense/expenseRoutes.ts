import { Request, Response, NextFunction } from "express"
import { Router }          from "express"
import { ExpenseService }  from "./expense.services.js"
import { validate }        from "../../middleware/validate.middleware.js"
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseFiltersSchema,
  idParamSchema,
} from "./expense.validation.js"
import type { ExpenseFilters } from "./expense.types.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Controllers ──────────────────────────────────────────────────────────────

/** GET /expenses/stats */
const getStats = asyncHandler(async (_req, res) => {
  const data = await ExpenseService.getStats()
  res.status(200).json({ success: true, data })
})

/** GET /expenses */
const getAllExpenses = asyncHandler(async (req, res) => {
  const filters: ExpenseFilters = {
    category:  req.query.category  as any,
    from:      req.query.from      as string,
    to:        req.query.to        as string,
    search:    req.query.search    as string,
    page:      Number(req.query.page)  || 1,
    limit:     Number(req.query.limit) || 15,
    sortBy:   (req.query.sortBy    as any) || "date",
    sortOrder:(req.query.sortOrder as any) || "desc",
  }
  const result = await ExpenseService.getAll(filters)
  res.status(200).json(result)
})

/** GET /expenses/:id */
const getExpenseById = asyncHandler(async (req, res) => {
  const data = await ExpenseService.getById(req.params.id)
  res.status(200).json({ success: true, data })
})

/** POST /expenses */
const createExpense = asyncHandler(async (req, res) => {
  const data = await ExpenseService.create(req.body)
  res.status(201).json({
    success: true,
    message: `Expense of ₹${data.amount.toLocaleString("en-IN")} recorded.`,
    data,
  })
})

/** PATCH /expenses/:id */
const updateExpense = asyncHandler(async (req, res) => {
  const data = await ExpenseService.update(req.params.id, req.body)
  res.status(200).json({ success: true, message: "Expense updated.", data })
})

/** DELETE /expenses/:id */
const deleteExpense = asyncHandler(async (req, res) => {
  await ExpenseService.delete(req.params.id)
  res.status(200).json({ success: true, message: "Expense deleted." })
})

// ─── Router ───────────────────────────────────────────────────────────────────
// Mount as: app.use("/api/admin/expenses", expenseRouter)

export const expenseRouter = Router()

expenseRouter.get   ("/stats", getStats)
expenseRouter.get   ("/",      validate(expenseFiltersSchema), getAllExpenses)
expenseRouter.get   ("/:id",   validate(idParamSchema),        getExpenseById)
expenseRouter.post  ("/",      validate(createExpenseSchema),  createExpense)
expenseRouter.patch ("/:id",   validate(updateExpenseSchema),  updateExpense)
expenseRouter.delete("/:id",   validate(idParamSchema),        deleteExpense)