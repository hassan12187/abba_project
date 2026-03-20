import { Request, Response, NextFunction } from "express"
import { StudentInvoiceService } from "./feeinvoice.student.service.js"
import { HttpError }             from "../../utils/errors.js"
import { InvoiceStatus }         from "./types.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extracts the authenticated student's ID from req.user (set by auth middleware). */
function requireStudentId(req: Request): string {
  const studentId = req.user?.student_id ?? req.user?.sub
  if (!studentId) throw HttpError.unauthorized("Student identity could not be determined.")
  return studentId
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /student/invoices
 * Returns the authenticated student's own invoices — paginated and filterable.
 */
export const getMyInvoices = asyncHandler(async (req, res) => {
  const studentId = requireStudentId(req)

  const result = await StudentInvoiceService.getMyInvoices(studentId, {
    status:       req.query.status       as InvoiceStatus | undefined,
    billingMonth: req.query.billingMonth as string | undefined,
    page:         Number(req.query.page)  || 1,
    limit:        Number(req.query.limit) || 10,
  })

  res.status(200).json({ success: true, ...result })
})

/**
 * GET /student/invoices/summary
 * Account balance summary card for the student dashboard.
 */
export const getMyInvoiceSummary = asyncHandler(async (req, res) => {
  const studentId = requireStudentId(req)
  const summary   = await StudentInvoiceService.getMySummary(studentId)
  res.status(200).json({ success: true, data: summary })
})

/**
 * GET /student/invoices/:id
 * Returns a single invoice — service enforces ownership.
 */
export const getMyInvoiceById = asyncHandler(async (req, res) => {
  const studentId = requireStudentId(req)
  const invoice   = await StudentInvoiceService.getMyInvoiceById(req.params.id, studentId)
  res.status(200).json({ success: true, data: invoice })
})