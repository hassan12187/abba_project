import { z } from "zod"

const objectId         = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId")
const paymentMethodEnum = z.enum(["Cash", "Bank Transfer", "Online", "Cheque"])
const paymentStatusEnum = z.enum(["successful", "pending", "failed"])
const isoDate          = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")

// ─── Create payment ───────────────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  body: z.object({
    student: objectId,

    invoices: z
      .array(
        z.object({
          invoiceId:     objectId,
          amountApplied: z
            .number({ invalid_type_error: "amountApplied must be a number" })
            .positive("amountApplied must be greater than 0")
            .transform((v) => Math.round(v * 100) / 100),
        })
      )
      .min(1, "At least one invoice allocation is required"),

    paymentMethod: paymentMethodEnum,
    paymentStatus: paymentStatusEnum.optional(),

    transactionId: z
      .string()
      .trim()
      .min(3, "transactionId must be at least 3 characters")
      .optional(),

    note: z.string().max(500).trim().optional(),
  }),
})

// ─── Filters / pagination ─────────────────────────────────────────────────────
export const paymentFiltersSchema = z.object({
  query: z
    .object({
      student_roll_no: z.string().optional(),
      paymentDate:     isoDate.optional(),
      fromDate:        isoDate.optional(),
      toDate:          isoDate.optional(),
      paymentMethod:   paymentMethodEnum.optional(),
      paymentStatus:   paymentStatusEnum.optional(),
      page:            z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
      limit:           z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("10"),
      sortBy:          z.enum(["paymentDate", "totalAmount", "createdAt"]).optional().default("paymentDate"),
      sortOrder:       z.enum(["asc", "desc"]).optional().default("desc"),
    })
    .refine(
      (d) => !(d.fromDate && d.toDate && new Date(d.fromDate) > new Date(d.toDate)),
      { message: "fromDate must be before toDate" }
    ),
})

// ─── ID param ─────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})