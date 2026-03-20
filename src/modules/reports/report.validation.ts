import { z } from "zod"

const objectId      = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
const categoryEnum  = z.enum(["Salary","Utilities","Maintenance","Food","Rent","Equipment","Miscellaneous"])
const isoDate       = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
const yearMonth     = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be "YYYY-MM"')

// ─── Report filters ───────────────────────────────────────────────────────────
export const reportFiltersSchema = z.object({
  query: z
    .object({
      month:    yearMonth.optional(),
      fromDate: isoDate.optional(),
      toDate:   isoDate.optional(),
    })
    .refine(
      (d) => !(d.fromDate && !d.toDate) && !(!d.fromDate && d.toDate),
      { message: "Both fromDate and toDate must be provided together" }
    )
    .refine(
      (d) => !(d.fromDate && d.toDate && d.month),
      { message: "Provide either month or fromDate/toDate, not both" }
    )
    .refine(
      (d) => {
        if (d.fromDate && d.toDate) {
          return new Date(d.fromDate) <= new Date(d.toDate)
        }
        return true
      },
      { message: "fromDate must be before toDate" }
    ),
})

// ─── Expense schemas ──────────────────────────────────────────────────────────
export const createExpenseSchema = z.object({
  body: z.object({
    description: z.string().min(3).max(500).trim(),
    amount:      z.number().positive("Amount must be positive").transform((v) => Math.round(v * 100) / 100),
    category:    categoryEnum.optional(),
    date:        isoDate.optional(),
    note:        z.string().max(1000).trim().optional(),
  }),
})

export const updateExpenseSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      description: z.string().min(3).max(500).trim().optional(),
      amount:      z.number().positive().transform((v) => Math.round(v * 100) / 100).optional(),
      category:    categoryEnum.optional(),
      date:        isoDate.optional(),
      note:        z.string().max(1000).trim().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field" }),
})

export const expenseFiltersSchema = z.object({
  query: z.object({
    category: categoryEnum.optional(),
    from:     isoDate.optional(),
    to:       isoDate.optional(),
    page:     z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:    z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("20"),
  }),
})

export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})

export const snapshotSchema = z.object({
  body: z.object({
    date: isoDate.optional(),   // defaults to today
  }),
})