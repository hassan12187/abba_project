import FeeInvoiceModel from "./FeeInvoice.js"
import {
  IFeeInvoice,
  InvoiceListItem,
  PaginatedResult,
  InvoiceStatus,
} from "./types.js"
import { HttpError } from "../../utils/errors.js"

export interface StudentInvoiceFilters {
  status?:      InvoiceStatus
  billingMonth?: string
  page?:        number
  limit?:       number
}

export interface StudentInvoiceSummary {
  totalInvoices:    number
  totalPaid:        number
  totalOutstanding: number
  overdueCount:     number
  lastPaymentDate:  Date | null
}

export const StudentInvoiceService = {

  /**
   * List all invoices belonging to the authenticated student.
   * The student_id is taken from the JWT — students can never
   * pass a different student_id to see someone else's invoices.
   */
  async getMyInvoices(
    studentId: string,
    filters: StudentInvoiceFilters
  ): Promise<PaginatedResult<InvoiceListItem>> {
    const { status, billingMonth, page = 1, limit = 10 } = filters

    const match: Record<string, unknown> = { student_id: studentId }
    if (status)       match.status       = status
    if (billingMonth) match.billingMonth = billingMonth

    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      FeeInvoiceModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "rooms", localField: "room_id",
            foreignField: "_id", as: "room",
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
            dueDate:       1,
            issueDate:     1,
            isLocked:      1,
            lineItems:     1,
            room_no:       "$room.room_no",
            room_id:       "$room._id",
            createdAt:     1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      FeeInvoiceModel.countDocuments(match),
    ])

    return {
      data:       rows as InvoiceListItem[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  /**
   * Get a single invoice — verifies it belongs to the requesting student.
   * Prevents horizontal privilege escalation (student A accessing student B's invoice).
   */
  async getMyInvoiceById(invoiceId: string, studentId: string): Promise<IFeeInvoice> {
    const invoice = await FeeInvoiceModel
      .findById(invoiceId)
      .populate("room_id",  "room_no floor block")
      .populate("payments", "amount paymentMethod createdAt note")
      .lean({ virtuals: true })

    if (!invoice) {
      throw HttpError.notFound(`Invoice not found.`)
    }

    // Ownership check — never expose another student's invoice
    if (invoice.student_id.toString() !== studentId) {
      throw HttpError.forbidden("You do not have access to this invoice.")
    }

    return invoice as IFeeInvoice
  },

  /**
   * Account summary card shown on the student dashboard.
   */
  async getMySummary(studentId: string): Promise<StudentInvoiceSummary> {
    const [agg, lastPayment] = await Promise.all([
      FeeInvoiceModel.aggregate([
        { $match: { student_id: studentId } },
        {
          $group: {
            _id:             null,
            totalInvoices:   { $sum: 1 },
            totalPaid:       { $sum: "$totalPaid" },
            totalOutstanding:{ $sum: { $subtract: ["$totalAmount", "$totalPaid"] } },
            overdueCount:    {
              $sum: { $cond: [{ $eq: ["$status", "Overdue"] }, 1, 0] },
            },
          },
        },
      ]),

      FeeInvoiceModel
        .findOne({ student_id: studentId, totalPaid: { $gt: 0 } })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean(),
    ])

    const stats = agg[0] ?? {
      totalInvoices: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0,
    }

    return {
      totalInvoices:    stats.totalInvoices,
      totalPaid:        stats.totalPaid,
      totalOutstanding: stats.totalOutstanding,
      overdueCount:     stats.overdueCount,
      lastPaymentDate:  lastPayment ? (lastPayment as any).updatedAt : null,
    }
  },
}