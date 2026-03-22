import { z } from "zod"
import { MEAL_TYPES, MEAL_STATUSES } from "./attendance.model.js"

const objectId     = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId")
const isoDate      = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
const mealTypeEnum = z.enum(MEAL_TYPES)
const statusEnum   = z.enum(MEAL_STATUSES)

// ─── Mark single attendance ───────────────────────────────────────────────────
export const markAttendanceSchema = z.object({
  body: z.object({
    student:  objectId,
    date:     isoDate,
    mealType: mealTypeEnum,
    status:   statusEnum,
    note:     z.string().max(300).trim().optional(),
  }),
})

// ─── Bulk mark ────────────────────────────────────────────────────────────────
export const bulkMarkSchema = z.object({
  body: z.object({
    date:     isoDate,
    mealType: mealTypeEnum,
    records:  z
      .array(
        z.object({
          student: objectId,
          status:  statusEnum,
          note:    z.string().max(300).trim().optional(),
        })
      )
      .min(1,   "records must have at least 1 entry")
      .max(500, "records cannot exceed 500 entries per bulk call"),
  }),
})

// ─── Update single record ─────────────────────────────────────────────────────
export const updateAttendanceSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      status: statusEnum.optional(),
      note:   z.string().max(300).trim().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Provide at least one field to update",
    }),
})

// ─── Filters ──────────────────────────────────────────────────────────────────
export const attendanceFiltersSchema = z.object({
  query: z
    .object({
      date:      isoDate.optional(),
      from:      isoDate.optional(),
      to:        isoDate.optional(),
      mealType:  mealTypeEnum.optional(),
      status:    statusEnum.optional(),
      student:   objectId.optional(),
      page:      z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
      limit:     z.string().transform(Number).pipe(z.number().int().min(1).max(200)).optional().default("50"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    })
    .refine(
      (d) => !(d.date && (d.from || d.to)),
      { message: "Use either date or from/to range, not both" }
    )
    .refine(
      (d) => !(d.from && d.to && new Date(d.from) > new Date(d.to)),
      { message: "from must be before to" }
    ),
})

// ─── Stats filters ────────────────────────────────────────────────────────────
export const statsFiltersSchema = z.object({
  query: z.object({
    from:     isoDate.optional(),
    to:       isoDate.optional(),
    mealType: mealTypeEnum.optional(),
    student:  objectId.optional(),
  })
  .refine(
    (d) => !(d.from && d.to && new Date(d.from) > new Date(d.to)),
    { message: "from must be before to" }
  ),
})

// ─── Student summary filters ──────────────────────────────────────────────────
export const studentSummarySchema = z.object({
  params: z.object({ studentId: objectId }),
  query: z.object({
    from: isoDate.optional(),
    to:   isoDate.optional(),
  }),
})

// ─── ID param ─────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})