import { z } from "zod"

// ─── Primitives ───────────────────────────────────────────────────────────────
const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId")

const billingMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'billingMonth must be in "YYYY-MM" format, e.g. "2026-01"')

const isoDate = z
  .string()
  .datetime({ message: "Must be a valid ISO 8601 date string" })
  .transform((v) => new Date(v))

const paymentMethodEnum = z.enum(["Cash", "Bank Transfer", "Online", "Cheque"])
const statusEnum        = z.enum(["Pending", "Paid", "Partially Paid", "Overdue", "Cancelled"])
const generatedByEnum   = z.enum(["AUTO", "MANUAL"])

const lineItemSchema = z.object({
  description: z.string().min(2, "Description must be at least 2 characters").max(200).trim(),
  amount:      z.number().positive("Amount must be a positive number").transform((v) => Math.round(v * 100) / 100),
})

// ─── Create invoice ───────────────────────────────────────────────────────────
export const createInvoiceSchema = z.object({
  body: z
    .object({
      student_id:   objectId,
      room_id:      objectId.optional(),
      billingMonth,
      dueDate:      isoDate,
      generatedBy:  generatedByEnum.optional(),
      lineItems:    z
        .array(lineItemSchema)
        .min(1, "Invoice must have at least one line item")
        .max(50, "Invoice cannot have more than 50 line items"),
    })
    .refine(
      (d) => {
        // dueDate must be in the future or within the billing month
        const [year, month] = d.billingMonth.split("-").map(Number)
        const billingEnd    = new Date(year, month, 0)   // last day of billing month
        return d.dueDate >= billingEnd
      },
      { message: "dueDate must be on or after the end of the billing month", path: ["dueDate"] }
    ),
})

// ─── Update invoice ───────────────────────────────────────────────────────────
export const updateInvoiceSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      dueDate:   isoDate.optional(),
      lineItems: z.array(lineItemSchema).min(1).max(50).optional(),
      room_id:   objectId.optional(),
      isLocked:  z.boolean().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "At least one field must be provided",
    }),
})

// ─── Add payment ──────────────────────────────────────────────────────────────
export const addPaymentSchema = z.object({
  params: z.object({ invoiceId: objectId }),
  body: z.object({
    // Round to 2 decimal places on the way in.
    // z.number().multipleOf(0.01) fails on clean values like 1500 due to
    // IEEE 754 floating point arithmetic — Math.round is the safe alternative.
    amount: z
      .number({ invalid_type_error: "amount must be a number" })
      .positive("Payment amount must be positive")
      .transform((v) => Math.round(v * 100) / 100),
    paymentMethod: paymentMethodEnum,
    note:          z.string().max(500).optional(),
  }),
})

// ─── Mark overdue ─────────────────────────────────────────────────────────────
export const markOverdueSchema = z.object({
  body: z.object({
    beforeDate: isoDate.optional(),
  }),
})

// ─── Cancel invoice ───────────────────────────────────────────────────────────
export const cancelInvoiceSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
  }),
})

// ─── ID param ─────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})

// ─── Filters / pagination ─────────────────────────────────────────────────────
export const invoiceFiltersSchema = z.object({
  query: z.object({
    status:       statusEnum.optional(),
    billingMonth: billingMonth.optional(),
    student_id:   objectId.optional(),
    generatedBy:  generatedByEnum.optional(),
    isLocked:     z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    page:         z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:        z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("10"),
    sortBy:       z.enum(["createdAt", "dueDate", "totalAmount"]).optional().default("createdAt"),
    sortOrder:    z.enum(["asc", "desc"]).optional().default("desc"),
  }),
})

// ─── Student search ───────────────────────────────────────────────────────────
export const studentSearchSchema = z.object({
  query: z.object({
    q: z
      .string({ required_error: "Search query 'q' is required" })
      .min(1, "Search query cannot be empty"),
  }),
})

// ─── Fee template ─────────────────────────────────────────────────────────────
export const createFeeTemplateSchema = z.object({
  body: z.object({
    name:        z.string().min(2).max(100).trim(),
    description: z.string().max(500).trim().optional(),
    frequency:   z.enum(["Monthly", "Semester", "One-Time"]),
    category:    z.string().min(2).max(100).trim(),
    totalAmount: z.number().positive().transform((v) => Math.round(v * 100) / 100),
    roomType:    z.string().max(50).optional(),
  }),
})