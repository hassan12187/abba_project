import { Schema, model } from "mongoose"

// ─── Enums ────────────────────────────────────────────────────────────────────
export const MEAL_TYPES    = ["Breakfast", "Lunch", "Dinner"] as const
export const MEAL_STATUSES = ["Present", "Absent", "Leave"]   as const

export type MealType   = (typeof MEAL_TYPES)[number]
export type MealStatus = (typeof MEAL_STATUSES)[number]

// ─── Schema ───────────────────────────────────────────────────────────────────
const mealAttendanceSchema = new Schema(
  {
    student: {
      type:     Schema.Types.ObjectId,
      ref:      "student_application",   // fixed typo: "student_appication"
      required: [true, "student is required"],
    },

    date: {
      type:     Date,
      required: [true, "date is required"],
    },

    mealType: {
      type:     String,
      enum:     MEAL_TYPES,
      required: [true, "mealType is required"],
    },

    status: {
      type:    String,
      enum:    MEAL_STATUSES,
      default: "Absent",
    },

    // ── Operational fields ─────────────────────────────────────────────────
    // Marked by mess staff when the student actually collects their meal
    markedAt: {
      type:    Date,
      default: null,
    },

    // Optional note (e.g. "on medical leave", "out-of-station")
    note: {
      type:      String,
      trim:      true,
      maxlength: 300,
      default:   null,
    },
  },
  {
    timestamps: true,          // createdAt + updatedAt
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
)

// ─── Compound unique index ────────────────────────────────────────────────────
// One record per student per meal per day — prevents duplicates
mealAttendanceSchema.index(
  { student: 1, date: 1, mealType: 1 },
  { unique: true, name: "unique_student_meal_per_day" }
)

// ─── Query indexes ────────────────────────────────────────────────────────────
mealAttendanceSchema.index({ date:     -1 })                // daily report queries
mealAttendanceSchema.index({ student:   1, date: -1 })     // per-student history
mealAttendanceSchema.index({ mealType:  1, date: -1 })     // per-meal analytics
mealAttendanceSchema.index({ status:    1, date: -1 })     // present/absent filters

const AttendanceRecord = model("AttendanceRecord", mealAttendanceSchema)
export default AttendanceRecord