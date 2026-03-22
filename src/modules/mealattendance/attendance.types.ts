import type { MealType, MealStatus } from "./attendance.model.js"
export type { MealType, MealStatus }

// ─── Populated shapes ─────────────────────────────────────────────────────────
export interface AttendanceStudent {
  _id:             string
  student_name:    string
  student_roll_no: string | number
  student_email:   string
}

export interface AttendanceRecord {
  _id:      string
  student:  AttendanceStudent
  date:     string             // ISO string
  mealType: MealType
  status:   MealStatus
  markedAt: string | null
  note:     string | null
  createdAt:string
  updatedAt:string
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** Mark a single meal for one student */
export interface MarkAttendanceDTO {
  student:  string             // ObjectId
  date:     string             // YYYY-MM-DD
  mealType: MealType
  status:   MealStatus
  note?:    string
}

/**
 * Bulk mark — used by mess staff to mark all students for a meal at once.
 * One call replaces N individual calls.
 */
export interface BulkMarkDTO {
  date:     string             // YYYY-MM-DD
  mealType: MealType
  records:  {
    student: string            // ObjectId
    status:  MealStatus
    note?:   string
  }[]
}

/** Body for PATCH /attendance/:id */
export interface UpdateAttendanceDTO {
  status?: MealStatus
  note?:   string
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface AttendanceFilters {
  date?:      string           // YYYY-MM-DD  exact day
  from?:      string           // YYYY-MM-DD  range start
  to?:        string           // YYYY-MM-DD  range end
  mealType?:  MealType  | ""
  status?:    MealStatus | ""
  student?:   string           // ObjectId
  page?:      number
  limit?:     number
  sortOrder?: "asc" | "desc"
}

// ─── API response wrappers ────────────────────────────────────────────────────
export interface PaginatedAttendanceResponse {
  success:    boolean
  data:       AttendanceRecord[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

export interface SingleAttendanceResponse {
  success:  boolean
  data:     AttendanceRecord
  message?: string
}

export interface BulkMarkResponse {
  success:  boolean
  message:  string
  data: {
    upserted: number           // new records created
    modified: number           // existing records updated
    total:    number
  }
}

// ─── Stats / Reports ──────────────────────────────────────────────────────────
export interface DailyMealSummary {
  date:      string
  mealType:  MealType
  present:   number
  absent:    number
  onLeave:   number
  total:     number
  attendancePct: number        // present / total * 100
}

export interface StudentAttendanceSummary {
  student:          AttendanceStudent
  totalMeals:       number
  present:          number
  absent:           number
  onLeave:          number
  attendancePct:    number
  byMeal: Record<MealType, { present: number; absent: number; onLeave: number }>
}

export interface AttendanceStatsResponse {
  success: boolean
  data: {
    dailySummary:   DailyMealSummary[]
    overallPresent: number
    overallAbsent:  number
    overallLeave:   number
    total:          number
    attendancePct:  number
  }
}