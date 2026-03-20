import { Types } from "mongoose"

// ─── Enums ────────────────────────────────────────────────────────────────────
export type InvoiceStatus   = "Pending" | "Paid" | "Partially Paid" | "Overdue" | "Cancelled"
export type GeneratedBy     = "AUTO" | "MANUAL"
export type PaymentMethod   = "Cash" | "Bank Transfer" | "Online" | "Cheque"

// ─── Sub-documents ────────────────────────────────────────────────────────────
export interface ILineItem {
  description: string
  amount:      number
  paid:        number
}

// ─── Core document ────────────────────────────────────────────────────────────
export interface IFeeInvoice {
  _id:           Types.ObjectId
  student_id:    Types.ObjectId
  room_id?:      Types.ObjectId
  invoiceNumber: string
  lineItems:     ILineItem[]
  issueDate:     Date
  dueDate:       Date
  billingMonth:  string           // "YYYY-MM"
  totalAmount:   number
  totalPaid:     number
  balanceDue:    number           // virtual
  status:        InvoiceStatus
  generatedBy:   GeneratedBy
  isLocked:      boolean
  payments:      Types.ObjectId[]
  createdAt:     Date
  updatedAt:     Date
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface LineItemDTO {
  description: string
  amount:      number
}

export interface CreateInvoiceDTO {
  student_id:   string
  room_id?:     string
  billingMonth: string
  dueDate:      string
  lineItems:    LineItemDTO[]
  generatedBy?: GeneratedBy
}

export interface UpdateInvoiceDTO {
  dueDate?:    string
  lineItems?:  LineItemDTO[]
  room_id?:    string
  isLocked?:   boolean
}

export interface AddPaymentDTO {
  amount:        number
  paymentMethod: PaymentMethod
  note?:         string
}

export interface MarkOverdueDTO {
  beforeDate?: string   // defaults to today
}

export interface CreateFeeTemplateDTO {
  name:        string
  description?: string
  frequency:   "Monthly" | "Semester" | "One-Time"
  category:    string
  totalAmount: number
  roomType?:   string
}

// ─── Query / filter ───────────────────────────────────────────────────────────
export interface InvoiceFilters {
  status?:       InvoiceStatus
  billingMonth?: string
  student_id?:   string
  generatedBy?:  GeneratedBy
  isLocked?:     boolean
  page?:         number
  limit?:        number
  sortBy?:       "createdAt" | "dueDate" | "totalAmount"
  sortOrder?:    "asc" | "desc"
}

export interface PaginatedResult<T> {
  data:       T[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

// ─── Aggregation response shapes ──────────────────────────────────────────────

/** Shape returned by getFeeInvoice aggregate */
export interface InvoiceListItem {
  _id:           Types.ObjectId
  invoiceNumber: string
  totalAmount:   number
  totalPaid:     number
  balanceDue:    number
  billingMonth:  string
  status:        InvoiceStatus
  dueDate:       Date
  student_name:  string
  student_id:    Types.ObjectId
  room_no?:      string
  room_id?:      Types.ObjectId
  createdAt:     Date
}

/** Lookup result after student search */
export interface StudentLookupResult {
  student_id:      Types.ObjectId
  student_name:    string
  student_roll_no: number
  room_id:         Types.ObjectId | null
  room_no:         string
}

/** Invoice stats for dashboard */
export interface InvoiceStats {
  byStatus:          Record<InvoiceStatus, number>
  totalRevenue:      number
  totalOutstanding:  number
  overdueCount:      number
  collectionRate:    number     // percentage
}