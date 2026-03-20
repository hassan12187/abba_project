import { z } from "zod"

const objectId      = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
const categoryEnum  = z.enum([
  "Salary","Utilities","Maintenance","Food","Rent","Equipment","Miscellaneous",
])
const isoDate       = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")

// ─── Create ───────────────────────────────────────────────────────────────────
export const createExpenseSchema = z.object({
  body: z.object({
    description: z
      .string({ required_error: "description is required" })
      .min(3,  "description must be at least 3 characters")
      .max(500,"description must be at most 500 characters")
      .trim(),

    amount: z
      .number({ required_error: "amount is required", invalid_type_error: "amount must be a number" })
      .positive("amount must be greater than 0")
      .transform((v) => Math.round(v * 100) / 100),

    category: categoryEnum.optional().default("Miscellaneous"),

    date: isoDate.optional(),

    note: z.string().max(1000).trim().optional(),
  }),
})

// ─── Update ───────────────────────────────────────────────────────────────────
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
    .refine((d) => Object.keys(d).length > 0, {
      message: "At least one field must be provided for update",
    }),
})

// ─── Filters ──────────────────────────────────────────────────────────────────
export const expenseFiltersSchema = z.object({
  query: z
    .object({
      category: categoryEnum.optional(),
      from:     isoDate.optional(),
      to:       isoDate.optional(),
      search:   z.string().max(200).optional(),
      page:     z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
      limit:    z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("15"),
      sortBy:   z.enum(["date","amount","createdAt"]).optional().default("date"),
      sortOrder:z.enum(["asc","desc"]).optional().default("desc"),
    })
    .refine(
      (d) => !(d.from && d.to && new Date(d.from) > new Date(d.to)),
      { message: "from must be before to" }
    ),
})

// ─── ID param ─────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})