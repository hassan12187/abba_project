import { startSession, SortOrder } from "mongoose"
import FeeInvoiceModel             from "./FeeInvoice.js"
import FeeTemplate                 from "../../models/FeeTemplate.js"
import studentApplicationModel     from "../student.application/studentApplicationModel.js"
import Counter                     from "../../models/Counter.js"
import redis                       from "../../services/Redis.js"
import Payment                     from "../payment/payment.model.js"
import {
  IFeeInvoice,
  InvoiceListItem,
  StudentLookupResult,
  InvoiceStats,
  CreateInvoiceDTO,
  UpdateInvoiceDTO,
  AddPaymentDTO,
  CreateFeeTemplateDTO,
  InvoiceFilters,
  PaginatedResult,
} from "./types.js"
import { HttpError } from "../../utils/errors.js"

// ─── Cache keys ───────────────────────────────────────────────────────────────
const TEMPLATE_CACHE_KEY    = "fee:templates"
const TEMPLATE_CACHE_TTL_S  = 60 * 60  // 1 hour

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates the next invoice number atomically using the Counter document. */
async function generateInvoiceNumber(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { id: "invoice_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )
  if (!counter) throw HttpError.internal("Counter sequence failed to generate.")
  const year = new Date().getFullYear()
  return `INV-${year}-${counter.seq.toString().padStart(4, "0")}`
}

/** Invalidates all Redis keys matching a prefix pattern. */
async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  let cursor = "0"
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100)
    cursor = nextCursor
    if (keys.length > 0) await redis.del(...keys)
  } while (cursor !== "0")
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const FeeInvoiceService = {

  /**
   * Paginated list with student + room details joined via aggregation.
   * Supports filtering by status, billingMonth, student_id, generatedBy, isLocked.
   */
  async getAll(filters: InvoiceFilters): Promise<PaginatedResult<InvoiceListItem>> {
    const {
      status, billingMonth, student_id, generatedBy, isLocked,
      page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc",
    } = filters

    const matchStage: Record<string, unknown> = {}
    if (status)       matchStage.status       = status
    if (billingMonth) matchStage.billingMonth  = billingMonth
    if (student_id)   matchStage.student_id   = student_id
    if (generatedBy)  matchStage.generatedBy  = generatedBy
    if (isLocked !== undefined) matchStage.isLocked = isLocked

    const skip  = (page - 1) * limit
    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder === "asc" ? 1 : -1 }

    const [rows, countResult] = await Promise.all([
      FeeInvoiceModel.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from:         "student_applications",
            localField:   "student_id",
            foreignField: "_id",
            as:           "student",
          },
        },
        { $unwind: { path: "$student", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from:         "rooms",
            localField:   "room_id",
            foreignField: "_id",
            as:           "room",
          },
        },
        { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            invoiceNumber: 1,
            totalAmount:   1,
            totalPaid:     1,
            balanceDue:    { $subtract: ["$totalAmount", "$totalPaid"] },
            billingMonth:  1,
            status:        1,
            isLocked:      1,
            generatedBy:   1,
            dueDate:       1,
            student_name:  "$student.student_name",
            student_id:    "$student._id",
            room_no:       "$room.room_no",
            room_id:       "$room._id",
            createdAt:     1,
          },
        },
        { $sort: sort },
        { $skip: skip },
        { $limit: limit },
      ]),
      FeeInvoiceModel.countDocuments(matchStage),
    ])

    return {
      data:       rows as InvoiceListItem[],
      total:      countResult,
      page,
      limit,
      totalPages: Math.ceil(countResult / limit),
    }
  },

  /**
   * Single invoice by ID with populated payment and student refs.
   */
  async getById(id: string): Promise<IFeeInvoice> {
    const invoice = await FeeInvoiceModel
      .findById(id)
      .populate("student_id", "student_name student_roll_no student_email")
      .populate("room_id",    "room_no floor block")
      .populate("payments",   "amount paymentMethod createdAt")
      .lean({ virtuals: true })

    if (!invoice) throw HttpError.notFound(`Invoice with id '${id}' not found.`)
    return invoice as IFeeInvoice
  },

  /**
   * Create a new invoice.
   * Enforces the unique (student_id + billingMonth) constraint with a clear error.
   * Invoice number is generated atomically via the Counter collection.
   */
  async create(dto: CreateInvoiceDTO): Promise<IFeeInvoice> {
    const duplicate = await FeeInvoiceModel.findOne({
      student_id:   dto.student_id,
      billingMonth: dto.billingMonth,
    })
    if (duplicate) {
      throw HttpError.conflict(
        `An invoice for student '${dto.student_id}' for month '${dto.billingMonth}' already exists.`
      )
    }

    const invoiceNumber = await generateInvoiceNumber()
    const totalAmount   = dto.lineItems.reduce((sum, item) => sum + item.amount, 0)

    const invoice = await FeeInvoiceModel.create({
      invoiceNumber,
      student_id:  dto.student_id,
      room_id:     dto.room_id,
      billingMonth: dto.billingMonth,
      dueDate:     dto.dueDate,
      lineItems:   dto.lineItems,
      totalAmount,
      totalPaid:   0,
      generatedBy: dto.generatedBy ?? "MANUAL",
    })

    return invoice.toObject({ virtuals: true }) as IFeeInvoice
  },

  /**
   * Update mutable fields on an invoice.
   * Locked invoices cannot be changed — admin must unlock first.
   * Recalculates totalAmount when lineItems are replaced.
   */
  async update(id: string, dto: UpdateInvoiceDTO): Promise<IFeeInvoice> {
    const invoice = await FeeInvoiceModel.findById(id)
    if (!invoice) throw HttpError.notFound(`Invoice with id '${id}' not found.`)

    if (invoice.isLocked && dto.isLocked !== false) {
      throw HttpError.locked(
        "This invoice is locked. Set isLocked: false to unlock it before making changes."
      )
    }

    // Recalculate totalAmount + re-derive status if lineItems change
    if (dto.lineItems) {
      const newTotal         = dto.lineItems.reduce((sum, i) => sum + i.amount, 0)
      invoice.totalAmount    = newTotal
      invoice.lineItems      = dto.lineItems as any
    }

    if (dto.dueDate)   invoice.dueDate  = new Date(dto.dueDate)
    if (dto.room_id)   invoice.room_id  = dto.room_id as any
    if (dto.isLocked !== undefined) invoice.isLocked = dto.isLocked

    await invoice.save()   // triggers pre-save hook for status re-derivation
    return invoice.toObject({ virtuals: true }) as IFeeInvoice
  },

  /**
   * Add a payment to an invoice inside a MongoDB session (atomic).
   * - Prevents over-payment
   * - Prevents payment on locked / cancelled invoices
   * - Creates a Payment document and links it to the invoice
   * - Status is re-derived by the pre-save hook
   */
  async addPayment(invoiceId: string, dto: AddPaymentDTO): Promise<{
    invoiceNumber: string
    totalPaid:     number
    balanceDue:    number
    status:        string
    paymentId:     string
  }> {
    const session = await startSession()

    try {
      session.startTransaction()

      const invoice = await FeeInvoiceModel.findById(invoiceId).session(session)
      if (!invoice) throw HttpError.notFound(`Invoice with id '${invoiceId}' not found.`)

      if (invoice.status === "Cancelled") {
        throw HttpError.badRequest("Cannot add payment to a cancelled invoice.")
      }
      if (invoice.isLocked) {
        throw HttpError.locked("This invoice is locked. Unlock it before adding a payment.")
      }

      const balanceDue = invoice.totalAmount - invoice.totalPaid
      if (dto.amount > balanceDue) {
        throw HttpError.badRequest(
          `Payment of ${dto.amount} exceeds the balance due of ${balanceDue}.`
        )
      }
      if (dto.amount <= 0) {
        throw HttpError.badRequest("Payment amount must be greater than zero.")
      }

      // Create the payment record
      const payment = new Payment({
        student:       invoice.student_id,
        paymentMethod: dto.paymentMethod,
        amount:        dto.amount,
        note:          dto.note,
        invoices:      [{ invoiceId: invoice._id, amountApplied: dto.amount }],
      })

      await payment.save({ session })

      // Update invoice
      invoice.totalPaid += dto.amount
      invoice.payments.push(payment._id as any)
      await invoice.save({ session })  // pre-save hook sets Paid / Partially Paid

      await session.commitTransaction()

      return {
        invoiceNumber: invoice.invoiceNumber,
        totalPaid:     invoice.totalPaid,
        balanceDue:    invoice.totalAmount - invoice.totalPaid,
        status:        invoice.status,
        paymentId:     payment._id.toString(),
      }
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction()
      throw err  // re-throw so the global handler formats the response
    } finally {
      await session.endSession()
    }
  },

  /**
   * Cancel an invoice — only allowed for Pending invoices with no payments.
   */
  async cancel(id: string, reason: string): Promise<IFeeInvoice> {
    const invoice = await FeeInvoiceModel.findById(id)
    if (!invoice) throw HttpError.notFound(`Invoice with id '${id}' not found.`)

    if (invoice.status === "Cancelled") {
      throw HttpError.badRequest("Invoice is already cancelled.")
    }
    if (invoice.totalPaid > 0) {
      throw HttpError.badRequest(
        "Cannot cancel an invoice that has received payments. Reverse the payments first."
      )
    }

    invoice.status   = "Cancelled"
    invoice.isLocked = true
    await invoice.save()

    return invoice.toObject({ virtuals: true }) as IFeeInvoice
  },

  /**
   * Bulk-mark Active invoices whose dueDate has passed as Overdue.
   * Designed to be called by a cron job. Returns the count of updated documents.
   */
  async markOverdue(beforeDate?: Date): Promise<{ modifiedCount: number }> {
    const cutoff = beforeDate ?? new Date()

    const result = await FeeInvoiceModel.updateMany(
      {
        status:  { $in: ["Pending", "Partially Paid"] },
        dueDate: { $lt: cutoff },
      },
      { $set: { status: "Overdue" } }
    )

    return { modifiedCount: result.modifiedCount }
  },

  /**
   * Student lookup by roll number — used when creating an invoice manually.
   */
  async findStudentByRollNo(rollNo: string | number): Promise<StudentLookupResult> {
    const student = await studentApplicationModel
      .findOne({ student_roll_no: rollNo }, "student_name student_roll_no")
      .populate("room_id", "room_no")
      .lean()

    if (!student) throw HttpError.notFound(`No student found with roll number '${rollNo}'.`)

    return {
      student_id:      student._id as any,
      student_name:    student.student_name,
      student_roll_no: student.student_roll_no as number,
      room_id:         (student.room_id as any)?._id ?? null,
      room_no:         (student.room_id as any)?.room_no ?? "N/A",
    }
  },

  /**
   * Dashboard stats aggregation.
   */
  async getStats(): Promise<InvoiceStats> {
    const [statusAgg, amountAgg] = await Promise.all([
      FeeInvoiceModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      FeeInvoiceModel.aggregate([
        {
          $group: {
            _id:             null,
            totalRevenue:    { $sum: "$totalPaid"   },
            totalOutstanding:{ $sum: { $subtract: ["$totalAmount", "$totalPaid"] } },
            overdueCount:    { $sum: { $cond: [{ $eq: ["$status", "Overdue"]  }, 1, 0] } },
            totalAmount:     { $sum: "$totalAmount" },
          },
        },
      ]),
    ])

    const byStatus: Record<string, number> = {}
    for (const row of statusAgg) byStatus[row._id] = row.count

    const amounts        = amountAgg[0] ?? { totalRevenue: 0, totalOutstanding: 0, overdueCount: 0, totalAmount: 0 }
    const collectionRate = amounts.totalAmount > 0
      ? Math.round((amounts.totalRevenue / amounts.totalAmount) * 100)
      : 0

    return {
      byStatus:         byStatus as InvoiceStats["byStatus"],
      totalRevenue:     amounts.totalRevenue,
      totalOutstanding: amounts.totalOutstanding,
      overdueCount:     amounts.overdueCount,
      collectionRate,
    }
  },

  // ─── Fee Templates ─────────────────────────────────────────────────────────

  /**
   * Get all fee templates.
   * Result is Redis-cached for 1 hour; cache is invalidated on write.
   */
  async getFeeTemplates() {
    const cached = await redis.get(TEMPLATE_CACHE_KEY)
    if (cached) return JSON.parse(cached)

    const templates = await FeeTemplate.find(
      {},
      "name description frequency category roomType totalAmount"
    ).lean()

    if (templates.length === 0) throw HttpError.notFound("No fee templates found.")

    await redis.set(TEMPLATE_CACHE_KEY, JSON.stringify(templates), "EX", TEMPLATE_CACHE_TTL_S)
    return templates
  },

  /**
   * Create a fee template and invalidate the template cache.
   */
  async createFeeTemplate(dto: CreateFeeTemplateDTO) {
    const existing = await FeeTemplate.findOne({ name: dto.name })
    if (existing) throw HttpError.conflict(`A template named '${dto.name}' already exists.`)

    const template = await FeeTemplate.create(dto)
    await invalidateCacheByPrefix("fee:templates")
    return template.toObject()
  },

  /**
   * Delete a fee template and invalidate the cache.
   */
  async deleteFeeTemplate(id: string) {
    const template = await FeeTemplate.findByIdAndDelete(id)
    if (!template) throw HttpError.notFound(`Template with id '${id}' not found.`)
    await invalidateCacheByPrefix("fee:templates")
  },
}