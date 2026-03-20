import { z } from "zod"

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId")

const billingMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'billingMonth must be in "YYYY-MM" format')

const statusEnum = z.enum(["Pending", "Paid", "Partially Paid", "Overdue", "Cancelled"])

/** GET /student/invoices?status=&billingMonth=&page=&limit= */
export const myInvoiceFiltersSchema = z.object({
  query: z.object({
    status:       statusEnum.optional(),
    billingMonth: billingMonth.optional(),
    page:         z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:        z.string().transform(Number).pipe(z.number().int().min(1).max(50)).optional().default("10"),
  }),
})

/** GET /student/invoices/:id */
export const myInvoiceIdSchema = z.object({
  params: z.object({ id: objectId }),
})