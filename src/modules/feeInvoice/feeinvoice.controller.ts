import { Request, Response, NextFunction } from "express"
import { FeeInvoiceService } from "./feeinvoice.services.js"
import { InvoiceFilters }    from "./types.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Invoice CRUD ─────────────────────────────────────────────────────────────

/**
 * GET /invoices
 * Paginated list with optional filters.
 */
export const getAllInvoices = asyncHandler(async (req, res) => {
  const filters: InvoiceFilters = {
    status:       req.query.status       as InvoiceFilters["status"],
    billingMonth: req.query.billingMonth as string,
    student_id:   req.query.student_id   as string,
    generatedBy:  req.query.generatedBy  as InvoiceFilters["generatedBy"],
    isLocked:     req.query.isLocked     as unknown as boolean,
    page:         Number(req.query.page)  || 1,
    limit:        Number(req.query.limit) || 10,
    sortBy:       req.query.sortBy       as InvoiceFilters["sortBy"],
    sortOrder:    req.query.sortOrder    as InvoiceFilters["sortOrder"],
  }
  const result = await FeeInvoiceService.getAll(filters)
  res.status(200).json({ success: true, ...result })
})

/**
 * GET /invoices/stats
 * Dashboard summary — must be declared before /:id.
 */
export const getInvoiceStats = asyncHandler(async (_req, res) => {
  const stats = await FeeInvoiceService.getStats()
  res.status(200).json({ success: true, data: stats })
})

/**
 * GET /invoices/:id
 */
export const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoiceService.getById(req.params.id)
  res.status(200).json({ success: true, data: invoice })
})

/**
 * POST /invoices
 */
export const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoiceService.create(req.body)
  res.status(201).json({
    success: true,
    message: `Invoice ${invoice.invoiceNumber} created successfully.`,
    data: invoice,
  })
})

/**
 * PATCH /invoices/:id
 */
export const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoiceService.update(req.params.id, req.body)
  res.status(200).json({
    success: true,
    message: "Invoice updated successfully.",
    data: invoice,
  })
})

/**
 * PATCH /invoices/:id/cancel
 */
export const cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoiceService.cancel(req.params.id, req.body.reason)
  res.status(200).json({
    success: true,
    message: `Invoice ${invoice.invoiceNumber} has been cancelled.`,
    data: invoice,
  })
})

// ─── Payments ─────────────────────────────────────────────────────────────────

/**
 * POST /invoices/:invoiceId/payments
 */
export const addPayment = asyncHandler(async (req, res) => {
  const result = await FeeInvoiceService.addPayment(req.params.invoiceId, req.body)
  res.status(200).json({
    success: true,
    message: "Payment recorded successfully.",
    data: result,
  })
})

// ─── Cron / admin actions ─────────────────────────────────────────────────────

/**
 * POST /invoices/mark-overdue
 * Bulk-marks past-due invoices as Overdue.
 * Called by a cron job or manually by an admin.
 */
export const markOverdueInvoices = asyncHandler(async (req, res) => {
  const beforeDate = req.body.beforeDate ? new Date(req.body.beforeDate) : undefined
  const result     = await FeeInvoiceService.markOverdue(beforeDate)
  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} invoice(s) marked as Overdue.`,
    data: result,
  })
})

// ─── Student lookup ───────────────────────────────────────────────────────────

/**
 * GET /invoices/students/search?q=<rollNo>
 */
export const searchStudent = asyncHandler(async (req, res) => {
  const student = await FeeInvoiceService.findStudentByRollNo(req.query.q as string)
  res.status(200).json({ success: true, data: student })
})

// ─── Fee templates ────────────────────────────────────────────────────────────

/**
 * GET /invoices/templates
 */
export const getFeeTemplates = asyncHandler(async (_req, res) => {
  const templates = await FeeInvoiceService.getFeeTemplates()
  res.status(200).json({ success: true, data: templates })
})

/**
 * POST /invoices/templates
 */
export const createFeeTemplate = asyncHandler(async (req, res) => {
  const template = await FeeInvoiceService.createFeeTemplate(req.body)
  res.status(201).json({
    success: true,
    message: "Fee template created successfully.",
    data: template,
  })
})

/**
 * DELETE /invoices/templates/:id
 */
export const deleteFeeTemplate = asyncHandler(async (req, res) => {
  await FeeInvoiceService.deleteFeeTemplate(req.params.id)
  res.status(200).json({
    success: true,
    message: "Fee template deleted.",
  })
})