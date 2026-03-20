import mongoose, { FilterQuery, SortOrder } from "mongoose"
import Payment            from "../payment/payment.model.js"
import FeeInvoiceModel    from "../feeInvoice/FeeInvoice.js"
import studentApplication from "../student.application/studentApplicationModel.js"
import redis              from "../../services/Redis.js"
import {
  CreatePaymentDTO, PaymentFilters,
  PaginatedPayments, PopulatedPayment,
} from "./payment.types.js"
import { HttpError } from "../../utils/errors.js"

// ─── Cache config ─────────────────────────────────────────────────────────────
//
// Cache strategy:
//
//   GET /payments?...   → "payment:list:<fingerprint>"   TTL 2 min
//     Filters (roll no, date, method, status, page) produce many key variants.
//     Short TTL prevents stale pages from accumulating. Invalidated on create.
//
//   GET /payments/stats → "payment:stats"                TTL 10 min
//     Three parallel aggregations on every load — expensive at scale.
//     Safe to serve slightly stale; invalidated on every new payment.
//
//   GET /payments/:id   → "payment:detail:<id>"          TTL 10 min
//     Payments are immutable after creation (no update route), so detail
//     cache never goes stale in normal use. Only cleared if record is deleted.
//
// Invalidation:
//   create → invalidate list prefix + stats (new record changes totals/pages)
//   (no update/delete route in this service, so no further invalidation needed)

const CACHE_PREFIX_LIST   = "payment:list:"
const CACHE_KEY_STATS     = "payment:stats"
const CACHE_PREFIX_DETAIL = "payment:detail:"

const TTL_LIST   =  2 * 60   //  2 minutes
const TTL_STATS  = 10 * 60   // 10 minutes
const TTL_DETAIL = 10 * 60   // 10 minutes (payments don't change after creation)

// ─── Cache helpers ────────────────────────────────────────────────────────────

/** Scan-and-delete all Redis keys matching a prefix. Non-blocking (uses SCAN). */
async function invalidatePrefix(prefix: string): Promise<void> {
  let cursor = "0"
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor, "MATCH", `${prefix}*`, "COUNT", 100
    )
    cursor = nextCursor
    if (keys.length > 0) await redis.del(...keys)
  } while (cursor !== "0")
}

/** Invalidate everything affected by a new payment being recorded. */
async function invalidateOnCreate(): Promise<void> {
  await Promise.all([
    invalidatePrefix(CACHE_PREFIX_LIST),
    redis.del(CACHE_KEY_STATS),
  ])
}

/**
 * Build a stable, sorted JSON fingerprint from filters.
 * Ensures { page:1, paymentMethod:"Cash" } and { paymentMethod:"Cash", page:1 }
 * produce the exact same cache key.
 */
function filtersKey(filters: PaymentFilters): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== "" && v !== null)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  )
}

// ─── Date range helper ────────────────────────────────────────────────────────
function buildDateFilter(filters: PaymentFilters): Record<string, any> | null {
  if (filters.paymentDate) {
    const start = new Date(filters.paymentDate); start.setHours(0,0,0,0)
    const end   = new Date(filters.paymentDate); end.setHours(23,59,59,999)
    return { $gte: start, $lte: end }
  }
  if (filters.fromDate || filters.toDate) {
    const range: any = {}
    if (filters.fromDate) {
      const d = new Date(filters.fromDate); d.setHours(0,0,0,0);       range.$gte = d
    }
    if (filters.toDate) {
      const d = new Date(filters.toDate);   d.setHours(23,59,59,999);  range.$lte = d
    }
    return range
  }
  return null
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const PaymentService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  async getAll(filters: PaymentFilters): Promise<PaginatedPayments> {
    const cacheKey = `${CACHE_PREFIX_LIST}${filtersKey(filters)}`

    // ── Cache hit ────────────────────────────────────────────────────────────
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // ── Cache miss — query MongoDB ────────────────────────────────────────────
    const {
      student_roll_no, paymentMethod, paymentStatus,
      page = 1, limit = 10,
      sortBy = "paymentDate", sortOrder = "desc",
    } = filters

    // Resolve roll number → ObjectIds first
    let studentIds: mongoose.Types.ObjectId[] | undefined
    if (student_roll_no) {
      const students = await studentApplication
        .find(
          { student_roll_no: { $regex: student_roll_no, $options: "i" } },
          { _id: 1 }
        )
        .lean()
      studentIds = students.map((s) => s._id as mongoose.Types.ObjectId)
      // No matching students — short-circuit before hitting Payment collection
      if (!studentIds.length) {
        const empty: PaginatedPayments = { data: [], total: 0, page, limit, totalPages: 0, totalAmount: 0 }
        // Cache the empty result too — avoids repeated student lookup for
        // the same bad roll number within the TTL window
        await redis.set(cacheKey, JSON.stringify(empty), "EX", TTL_LIST)
        return empty
      }
    }

    const query: FilterQuery<any> = {}
    if (studentIds)    query.student       = { $in: studentIds }
    if (paymentMethod) query.paymentMethod = paymentMethod
    if (paymentStatus) query.paymentStatus = paymentStatus

    const dateFilter = buildDateFilter(filters)
    if (dateFilter) query.paymentDate = dateFilter

    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder === "asc" ? 1 : -1 }
    const skip = (page - 1) * limit

    const [data, total, totalAmountAgg] = await Promise.all([
      Payment.find(query)
        .populate("student",            "student_name student_roll_no student_email")
        .populate("invoices.invoiceId", "invoiceNumber")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),

      Payment.countDocuments(query),

      Payment.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ])

    const result: PaginatedPayments = {
      data:        data as unknown as PopulatedPayment[],
      total,
      page,
      limit,
      totalPages:  Math.ceil(total / limit),
      totalAmount: Math.round((totalAmountAgg[0]?.total ?? 0) * 100) / 100,
    }

    await redis.set(cacheKey, JSON.stringify(result), "EX", TTL_LIST)
    return result
  },

  async getById(id: string): Promise<PopulatedPayment> {
    const cacheKey = `${CACHE_PREFIX_DETAIL}${id}`

    // ── Cache hit ────────────────────────────────────────────────────────────
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // ── Cache miss ────────────────────────────────────────────────────────────
    const payment = await Payment.findById(id)
      .populate("student",            "student_name student_roll_no student_email student_cellphone")
      .populate("invoices.invoiceId", "invoiceNumber billingMonth totalAmount balanceDue status")
      .lean()

    if (!payment) throw HttpError.notFound(`Payment ${id} not found.`)

    await redis.set(cacheKey, JSON.stringify(payment), "EX", TTL_DETAIL)
    return payment as unknown as PopulatedPayment
  },

  async getStats() {
    // ── Cache hit ────────────────────────────────────────────────────────────
    const cached = await redis.get(CACHE_KEY_STATS)
    if (cached) return JSON.parse(cached)

    // ── Cache miss — three aggregations in parallel ────────────────────────
    const [statusBreakdown, methodBreakdown, totals] = await Promise.all([
      Payment.aggregate([
        { $group: {
          _id:    "$paymentStatus",
          count:  { $sum: 1 },
          amount: { $sum: "$totalAmount" },
        }},
      ]),
      Payment.aggregate([
        { $group: {
          _id:    "$paymentMethod",
          count:  { $sum: 1 },
          amount: { $sum: "$totalAmount" },
        }},
      ]),
      Payment.aggregate([
        { $group: {
          _id:   null,
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        }},
      ]),
    ])

    const result = {
      byStatus: Object.fromEntries(
        statusBreakdown.map(({ _id, count, amount }) => [
          _id, { count, amount: Math.round(amount * 100) / 100 },
        ])
      ),
      byMethod: Object.fromEntries(
        methodBreakdown.map(({ _id, count, amount }) => [
          _id, { count, amount: Math.round(amount * 100) / 100 },
        ])
      ),
      totalAmount: Math.round((totals[0]?.total ?? 0) * 100) / 100,
      totalCount:  totals[0]?.count ?? 0,
    }

    await redis.set(CACHE_KEY_STATS, JSON.stringify(result), "EX", TTL_STATS)
    return result
  },

  // ── WRITE ───────────────────────────────────────────────────────────────────

  async create(dto: CreatePaymentDTO): Promise<PopulatedPayment> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // Validate all invoices exist and belong to the student
      const invoiceIds = dto.invoices.map((i) => i.invoiceId)
      const invoices   = await FeeInvoiceModel.find(
        { _id: { $in: invoiceIds }, student_id: dto.student },
        { _id: 1, balanceDue: 1, status: 1, isLocked: 1 }
      ).session(session)

      if (invoices.length !== invoiceIds.length) {
        throw HttpError.badRequest(
          "One or more invoice IDs are invalid or don't belong to this student."
        )
      }

      // Guard: reject locked or already-closed invoices
      for (const inv of invoices) {
        if (inv.isLocked) {
          throw HttpError.locked(`Invoice ${inv._id} is locked.`)
        }
        if (inv.status === "Paid") {
          throw HttpError.badRequest(`Invoice ${inv._id} is already fully paid.`)
        }
        if (inv.status === "Cancelled") {
          throw HttpError.badRequest(`Invoice ${inv._id} has been cancelled.`)
        }
      }

      // Guard: prevent over-payment per invoice
      for (const allocation of dto.invoices) {
        const inv = invoices.find((i) => i._id.toString() === allocation.invoiceId)
        if (inv && allocation.amountApplied > inv.balanceDue + 0.01) {
          throw HttpError.badRequest(
            `Payment of ₹${allocation.amountApplied} for invoice ${allocation.invoiceId} ` +
            `exceeds balance due (₹${inv.balanceDue}).`
          )
        }
      }

      // Create payment document inside the transaction
      const [payment] = await Payment.create(
        [
          {
            student:       dto.student,
            invoices:      dto.invoices.map((i) => ({
              invoiceId:     i.invoiceId,
              amountApplied: Math.round(i.amountApplied * 100) / 100,
            })),
            paymentMethod: dto.paymentMethod,
            paymentStatus: dto.paymentStatus ?? "successful",
            transactionId: dto.transactionId,
            note:          dto.note,
          },
        ],
        { session }
      )

      // Update each invoice's paid amount, balance, and status
      for (const allocation of dto.invoices) {
        const inv        = invoices.find((i) => i._id.toString() === allocation.invoiceId)!
        const newBalance = Math.max(
          0, Math.round((inv.balanceDue - allocation.amountApplied) * 100) / 100
        )
        const newStatus =
          newBalance <= 0       ? "Paid"
          : newBalance < inv.balanceDue ? "Partially Paid"
          : inv.status

        await FeeInvoiceModel.findByIdAndUpdate(
          allocation.invoiceId,
          {
            $inc:  { totalPaid: allocation.amountApplied },
            $set:  { balanceDue: newBalance, status: newStatus },
            $push: { payments: payment._id },
          },
          { session }
        )
      }

      await session.commitTransaction()

      // ── Invalidate caches after successful commit ─────────────────────────
      // Done AFTER commit so we never serve a cache that references a rolled-back doc.
      // Fire-and-forget: don't block the response waiting for Redis.
      invalidateOnCreate().catch((err) =>
        console.error("[PaymentService] Cache invalidation failed:", err)
      )

      // Return the fully populated payment
      return PaymentService.getById(payment._id.toString())
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }
  },
}