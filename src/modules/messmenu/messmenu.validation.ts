import { z } from "zod"

// ─── Reusable primitives ──────────────────────────────────────────────────────

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId")

const dayOfWeekEnum = z.enum([
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
])

const mealTypeEnum = z.enum(["breakfast", "lunch", "dinner"])

/**
 * Time must be in "HH:MM AM/PM" format, e.g. "07:30 AM", "09:00 PM".
 * Validates hours 01-12, minutes 00-59.
 */
const timeString = z
  .string()
  .regex(
    /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/,
    'Time must be in "HH:MM AM/PM" format, e.g. "07:30 AM"'
  )

const menuItemString = z
  .string()
  .min(2, "Item must be at least 2 characters")
  .max(80, "Item must be at most 80 characters")
  .trim()

const mealSchema = z
  .object({
    items:     z.array(menuItemString).max(20, "A meal can have at most 20 items").optional(),
    startTime: timeString.optional(),
    endTime:   timeString.optional(),
  })
  .refine(
    (d) => {
      // Only validate ordering when both times are provided
      if (!d.startTime || !d.endTime) return true
      return toMinutes(d.startTime) < toMinutes(d.endTime)
    },
    { message: "startTime must be before endTime", path: ["startTime"] }
  )

/** Convert "HH:MM AM/PM" to total minutes since midnight for comparison */
function toMinutes(time: string): number {
  const [hhmm, period] = time.split(" ")
  let [h, m]           = hhmm.split(":").map(Number)
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h  = 0
  return h * 60 + m
}

// ─── Create one day ───────────────────────────────────────────────────────────
export const createMenuSchema = z.object({
  body: z.object({
    dayOfWeek: dayOfWeekEnum,
    breakfast: mealSchema.optional(),
    lunch:     mealSchema.optional(),
    dinner:    mealSchema.optional(),
  }),
})

// ─── Update one day ───────────────────────────────────────────────────────────
export const updateMenuSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      breakfast: mealSchema.optional(),
      lunch:     mealSchema.optional(),
      dinner:    mealSchema.optional(),
    })
    .refine((d) => d.breakfast || d.lunch || d.dinner, {
      message: "Provide at least one meal (breakfast, lunch, or dinner) to update",
    }),
})

// ─── Update meal items (add / remove) ────────────────────────────────────────
export const updateMealItemsSchema = z.object({
  params: z.object({
    id:       objectId,
    mealType: mealTypeEnum,
  }),
  body: z
    .object({
      add:    z.array(menuItemString).max(20).optional(),
      remove: z.array(z.string()).max(20).optional(),
    })
    .refine((d) => (d.add?.length ?? 0) + (d.remove?.length ?? 0) > 0, {
      message: "Provide at least one item in 'add' or 'remove'",
    }),
})

// ─── Update meal timing ───────────────────────────────────────────────────────
export const updateMealTimingSchema = z.object({
  params: z.object({
    id:       objectId,
    mealType: mealTypeEnum,
  }),
  body: z
    .object({
      startTime: timeString.optional(),
      endTime:   timeString.optional(),
    })
    .refine((d) => d.startTime || d.endTime, {
      message: "Provide at least one of startTime or endTime",
    })
    .refine(
      (d) => {
        if (!d.startTime || !d.endTime) return true
        return toMinutes(d.startTime) < toMinutes(d.endTime)
      },
      { message: "startTime must be before endTime", path: ["startTime"] }
    ),
})

// ─── Day-param (by dayOfWeek string) ─────────────────────────────────────────
export const dayParamSchema = z.object({
  params: z.object({ day: dayOfWeekEnum }),
})

// ─── ID param ─────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})

// ─── Bulk upsert (seed entire week) ──────────────────────────────────────────
export const bulkUpsertSchema = z.object({
  body: z
    .array(
      z.object({
        dayOfWeek: dayOfWeekEnum,
        breakfast: mealSchema.optional(),
        lunch:     mealSchema.optional(),
        dinner:    mealSchema.optional(),
      })
    )
    .min(1, "Provide at least one day")
    .max(7, "Cannot exceed 7 days")
    .refine(
      (days) => new Set(days.map((d) => d.dayOfWeek)).size === days.length,
      { message: "Each day of the week must appear at most once in the request" }
    ),
})