import { Router } from "express"

// ─── Admin controllers ────────────────────────────────────────────────────────
import {
  getAllInvoices,
  getInvoiceStats,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  cancelInvoice,
  addPayment,
  markOverdueInvoices,
  searchStudent,
  getFeeTemplates,
  createFeeTemplate,
  deleteFeeTemplate,
} from "./feeinvoice.controller.js"

// ─── Student controllers ──────────────────────────────────────────────────────
import {
  getMyInvoices,
  getMyInvoiceSummary,
  getMyInvoiceById,
} from "./feeinvoice.student.controller.js"

// ─── Auth middleware ──────────────────────────────────────────────────────────
import { authenticate, isAdmin, isStaff, isStudent } from "../../middleware/Auth.middleware.js"

// ─── Validation middleware ────────────────────────────────────────────────────
import { validate } from "../../middleware/validate.middleware.js"
import {
  invoiceFiltersSchema,
  idParamSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  addPaymentSchema,
  cancelInvoiceSchema,
  markOverdueSchema,
  studentSearchSchema,
  createFeeTemplateSchema,
} from "./feeinvoice.validation.js"
import {
  myInvoiceFiltersSchema,
  myInvoiceIdSchema,
} from "./feeinvoice.student.validation.js"

const router = Router()

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ROUTES  — prefix: /invoices/me
// All routes require a valid student JWT.
// Students can only read their own data — ownership is enforced in the service.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /invoices/me/summary
 * Account balance summary (total paid, outstanding, overdue count).
 */
router.get("/me/summary", authenticate, isStudent, getMyInvoiceSummary)

/**
 * GET /invoices/me?status=Overdue&billingMonth=2026-01&page=1
 * Paginated list of the student's own invoices.
 */
router.get("/me", authenticate, isStudent, validate(myInvoiceFiltersSchema), getMyInvoices)

/**
 * GET /invoices/me/:id
 * Single invoice — ownership verified in service layer.
 */
router.get("/me/:id", authenticate, isStudent, validate(myInvoiceIdSchema), getMyInvoiceById)

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / STAFF ROUTES  — prefix: /invoices
// All routes require authentication. Role requirements vary per endpoint:
//   - isAdmin → only admins (writes, destructive ops)
//   - isStaff → admins + staff (reads, payment recording)
// ─────────────────────────────────────────────────────────────────────────────

// GET  /invoices/stats              — staff + admin
router.get("/stats",             authenticate, isStaff, getInvoiceStats)

// POST /invoices/mark-overdue       — admin only (bulk write)
router.post("/mark-overdue",     authenticate, isAdmin, validate(markOverdueSchema), markOverdueInvoices)

// GET  /invoices/students/search    — staff + admin
router.get("/students/search",   authenticate, isStaff, validate(studentSearchSchema), searchStudent)

// GET  /invoices/templates          — staff + admin
router.get("/templates",         authenticate, isStaff, getFeeTemplates)

// POST /invoices/templates          — admin only
router.post("/templates",        authenticate, isAdmin, validate(createFeeTemplateSchema), createFeeTemplate)

// DELETE /invoices/templates/:id    — admin only
router.delete("/templates/:id",  authenticate, isAdmin, validate(idParamSchema), deleteFeeTemplate)

// GET  /invoices                    — staff + admin
router.get("/",                  authenticate, isStaff, validate(invoiceFiltersSchema), getAllInvoices)

// POST /invoices                    — admin only
router.post("/",                 authenticate, isAdmin, validate(createInvoiceSchema), createInvoice)

// GET  /invoices/:id                — staff + admin
router.get("/:id",               authenticate, isStaff, validate(idParamSchema), getInvoiceById)

// PATCH /invoices/:id               — admin only
router.patch("/:id",             authenticate, isAdmin, validate(updateInvoiceSchema), updateInvoice)

// PATCH /invoices/:id/cancel        — admin only
router.patch("/:id/cancel",      authenticate, isAdmin, validate(cancelInvoiceSchema), cancelInvoice)

// POST /invoices/:invoiceId/payments — staff + admin (front desk)
router.post("/:invoiceId/payments", authenticate, isStaff, validate(addPaymentSchema), addPayment)

export default router