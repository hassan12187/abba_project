import { Types } from "mongoose"

export type PaymentMethod = "Cash" | "Bank Transfer" | "Online" | "Cheque"
export type PaymentStatus = "successful" | "pending" | "failed"

export interface IPaymentInvoice {
  invoiceId:     Types.ObjectId
  amountApplied: number
}

export interface IPayment {
  _id:           Types.ObjectId
  student:       Types.ObjectId
  invoices:      IPaymentInvoice[]
  totalAmount:   number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentDate:   Date
  transactionId?: string
  note?:         string
  createdAt:     Date
  updatedAt:     Date
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreatePaymentDTO {
  student:       string
  invoices:      { invoiceId: string; amountApplied: number }[]
  paymentMethod: PaymentMethod
  paymentStatus?: PaymentStatus
  transactionId?: string
  note?:         string
}

export interface PaymentFilters {
  student_roll_no?: string
  paymentDate?:     string          // YYYY-MM-DD
  fromDate?:        string
  toDate?:          string
  paymentMethod?:   PaymentMethod
  paymentStatus?:   PaymentStatus
  page?:            number
  limit?:           number
  sortBy?:          "paymentDate" | "totalAmount" | "createdAt"
  sortOrder?:       "asc" | "desc"
}

export interface PaginatedPayments {
  data:        PopulatedPayment[]
  total:       number
  page:        number
  limit:       number
  totalPages:  number
  totalAmount: number             // sum of all matching records (not just current page)
}

// ── Populated shapes (what the API returns) ───────────────────────────────────

export interface PopulatedPayment {
  _id:           string
  student: {
    _id:              string
    student_name:     string
    student_roll_no:  number
    student_email:    string
  }
  invoices: {
    invoiceId:      string
    invoiceNumber?: string
    amountApplied:  number
  }[]
  totalAmount:   number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentDate:   string
  transactionId?: string
  note?:         string
  createdAt:     string
}