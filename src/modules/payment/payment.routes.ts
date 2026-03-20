import { Request, Response, NextFunction } from "express"
import { Router }          from "express"
import { PaymentService }  from "./payment.services.js"
import { validate }        from "../../middleware/validate.middleware.js"
import {
  createPaymentSchema,
  paymentFiltersSchema,
  idParamSchema,
} from "./payment.validation.js"
import { PaymentFilters } from "./payment.types.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Controllers ──────────────────────────────────────────────────────────────

/** GET /payments/stats */
const getStats = asyncHandler(async (_req, res) => {
  const stats = await PaymentService.getStats()
  res.status(200).json({ success: true, data: stats })
})

/** GET /payments */
const getAllPayments = asyncHandler(async (req, res) => {
  const filters: PaymentFilters = {
    student_roll_no: req.query.student_roll_no as string,
    paymentDate:     req.query.paymentDate     as string,
    fromDate:        req.query.fromDate        as string,
    toDate:          req.query.toDate          as string,
    paymentMethod:   req.query.paymentMethod   as any,
    paymentStatus:   req.query.paymentStatus   as any,
    page:            Number(req.query.page)    || 1,
    limit:           Number(req.query.limit)   || 10,
    sortBy:          (req.query.sortBy         as any) || "paymentDate",
    sortOrder:       (req.query.sortOrder      as any) || "desc",
  }
  const result = await PaymentService.getAll(filters)
  res.status(200).json({ success: true, ...result })
})

/** GET /payments/:id */
const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await PaymentService.getById(req.params.id)
  res.status(200).json({ success: true, data: payment })
})

/** POST /payments */
const createPayment = asyncHandler(async (req, res) => {
  const payment = await PaymentService.create(req.body)
  res.status(201).json({
    success: true,
    message: `Payment of ₹${payment.totalAmount.toLocaleString("en-IN")} recorded successfully.`,
    data:    payment,
  })
})

// ─── Router ───────────────────────────────────────────────────────────────────
// Mount as:  app.use("/api/admin/payments", paymentRouter)
// Note: also mount as "/api/admin/payment" if the old frontend still calls that

export const paymentRouter = Router()

paymentRouter.get ("/stats", getStats)
paymentRouter.get ("/",      validate(paymentFiltersSchema), getAllPayments)
paymentRouter.get ("/:id",   validate(idParamSchema),        getPaymentById)
paymentRouter.post("/",      validate(createPaymentSchema),  createPayment)