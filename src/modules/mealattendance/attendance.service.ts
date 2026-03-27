import { FilterQuery, SortOrder, Types } from "mongoose"
import AttendanceRecord from "./attendance.model.js"
import redis            from "../../services/Redis.js"
import { HttpError }    from "../../utils/errors.js"
import type {
  MarkAttendanceDTO, BulkMarkDTO, UpdateAttendanceDTO,
  AttendanceFilters, AttendanceRecord as IAttendanceRecord,
  PaginatedAttendanceResponse, BulkMarkResponse,
  DailyMealSummary, StudentAttendanceSummary,
} from "./attendance.types.js"
import { MEAL_TYPES } from "./attendance.model.js"

// ─── Cache config ─────────────────────────────────────────────────────────────
//
//  "attendance:list:<fingerprint>"           TTL 1 min  — paginated records
//  "attendance:stats:<fingerprint>"          TTL 5 min  — aggregated summaries
//  "attendance:student:<id>:<from>:<to>"     TTL 5 min  — per-student summary
//  "attendance:daily:<date>:<mealType>"      TTL 2 min  — daily meal summary
//
// Bulk mark and individual marks invalidate list + stats + daily keys.
// Student summary keys are invalidated when that student's records change.

const PREFIX_LIST    = "attendance:list:"
const PREFIX_STATS   = "attendance:stats:"
const PREFIX_STUDENT = "attendance:student:"
const PREFIX_DAILY   = "attendance:daily:"

const TTL_LIST    = 1 * 60
const TTL_STATS   = 5 * 60
const TTL_STUDENT = 5 * 60
const TTL_DAILY   = 2 * 60

async function invalidatePrefix(prefix: string): Promise<void> {
  let cursor = "0"
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100)
    cursor = next
    if (keys.length) await redis.del(...keys)
  } while (cursor !== "0")
}

/** Invalidate everything related to a set of student IDs */
async function invalidateOnWrite(studentIds: string[]): Promise<void> {
  const ops: Promise<any>[] = [
    invalidatePrefix(PREFIX_LIST),
    invalidatePrefix(PREFIX_STATS),
    invalidatePrefix(PREFIX_DAILY),
    // Drop cached summaries for affected students
    ...studentIds.map((id) => invalidatePrefix(`${PREFIX_STUDENT}${id}`)),
  ]
  await Promise.all(ops)
}

function filtersKey(f: AttendanceFilters | Record<string, any>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(f)
        .filter(([, v]) => v !== undefined && v !== "")
        .sort(([a], [b]) => a.localeCompare(b))
    )
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0);      return r }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r }

function buildDateQuery(filters: AttendanceFilters): Record<string, any> | null {
  if (filters.date) {
    const d = new Date(filters.date)
    return { $gte: startOfDay(d), $lte: endOfDay(d) }
  }
  if (filters.from || filters.to) {
    const range: any = {}
    if (filters.from) range.$gte = startOfDay(new Date(filters.from))
    if (filters.to)   range.$lte = endOfDay(new Date(filters.to))
    return range
  }
  return null
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const AttendanceService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  async getAll(filters: AttendanceFilters): Promise<PaginatedAttendanceResponse> {
    const cacheKey = `${PREFIX_LIST}${filtersKey(filters)}`
    const cached   = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const {
      mealType, status, student,
      page = 1, limit = 50, sortOrder = "desc",
    } = filters

    const query: FilterQuery<any> = {}
    if (mealType) query.mealType = mealType
    if (status)   query.status   = status
    if (student)  query.student  = student

    const dateQ = buildDateQuery(filters)
    if (dateQ) query.date = dateQ

    const sort: Record<string, SortOrder> = { date: sortOrder === "asc" ? 1 : -1, mealType: 1 }
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      AttendanceRecord.find(query)
        .populate("student", "student_name student_roll_no student_email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AttendanceRecord.countDocuments(query),
    ])

    const result: PaginatedAttendanceResponse = {
      success:    true,
      data:       data as unknown as IAttendanceRecord[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    await redis.set(cacheKey, JSON.stringify(result), "EX", TTL_LIST)
    return result
  },

  async getById(id: string): Promise<IAttendanceRecord> {
    const attendance = await AttendanceRecord.findById(id)
      .populate("student", "student_name student_roll_no student_email")
      .lean()
    if (!attendance) throw HttpError.notFound(`Attendance record ${id} not found.`)
    return attendance as unknown as IAttendanceRecord
  },

  /**
   * Daily meal summary — how many students were present/absent/leave
   * for each meal on a given date range. Used by the mess panel chart.
   */
  async getDailySummary(
    from: string,
    to:   string,
    mealType?: string
  ): Promise<DailyMealSummary[]> {
    const cacheKey = `${PREFIX_STATS}daily:${from}:${to}:${mealType ?? "all"}`
    const cached   = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const matchStage: any = {
      date: {
        $gte: startOfDay(new Date(from)),
        $lte: endOfDay(new Date(to)),
      },
    }
    if (mealType) matchStage.mealType = mealType

    const rows = await AttendanceRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:      { date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, mealType: "$mealType" },
          present:  { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
          absent:   { $sum: { $cond: [{ $eq: ["$status", "Absent"]  }, 1, 0] } },
          onLeave:  { $sum: { $cond: [{ $eq: ["$status", "Leave"]   }, 1, 0] } },
          total:    { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1, "_id.mealType": 1 } },
      {
        $project: {
          _id:           0,
          date:          "$_id.date",
          mealType:      "$_id.mealType",
          present:       1,
          absent:        1,
          onLeave:       1,
          total:         1,
          attendancePct: {
            $cond: [
              { $gt: ["$total", 0] },
              { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
    ])

    await redis.set(cacheKey, JSON.stringify(rows), "EX", TTL_STATS)
    return rows
  },

  /**
   * Per-student attendance summary over a date range.
   * Breaks down by meal type with overall percentage.
   */
  async getStudentSummary(
    studentId: string,
    from?:     string,
    to?:       string
  ): Promise<StudentAttendanceSummary> {
    const cacheKey = `${PREFIX_STUDENT}${studentId}:${from ?? "start"}:${to ?? "end"}`
    const cached   = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const match: any = { student: new Types.ObjectId(studentId) }
    if (from || to) {
      match.date = {}
      if (from) match.date.$gte = startOfDay(new Date(from))
      if (to)   match.date.$lte = endOfDay(new Date(to))
    }

    const [byMealRows, studentDoc] = await Promise.all([
      AttendanceRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id:     "$mealType",
            present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
            absent:  { $sum: { $cond: [{ $eq: ["$status", "Absent"]  }, 1, 0] } },
            onLeave: { $sum: { $cond: [{ $eq: ["$status", "Leave"]   }, 1, 0] } },
          },
        },
      ]),
      AttendanceRecord.findOne({ student: studentId })
        .populate("student", "student_name student_roll_no student_email")
        .lean(),
    ])

    if (!studentDoc) throw HttpError.notFound(`No attendance records found for student ${studentId}.`)
      console.log(byMealRows);
      console.log(studentDoc);
    const byMeal: Record<string, { present: number; absent: number; onLeave: number }> = {}
    let totalPresent = 0, totalAbsent = 0, totalLeave = 0

    for (const row of byMealRows) {
      byMeal[row._id] = { present: row.present, absent: row.absent, onLeave: row.onLeave }
      totalPresent += row.present
      totalAbsent  += row.absent
      totalLeave   += row.onLeave
    }

    // Fill in zero entries for meal types with no records
    for (const meal of MEAL_TYPES) {
      if (!byMeal[meal]) byMeal[meal] = { present: 0, absent: 0, onLeave: 0 }
    }

    const total = totalPresent + totalAbsent + totalLeave
    const result: StudentAttendanceSummary = {
      student:          (studentDoc as any).student,
      totalMeals:       total,
      present:          totalPresent,
      absent:           totalAbsent,
      onLeave:          totalLeave,
      attendancePct:    total > 0 ? Math.round((totalPresent / total) * 1000) / 10 : 0,
      byMeal:           byMeal as any,
    }

    await redis.set(cacheKey, JSON.stringify(result), "EX", TTL_STUDENT)
    return result
  },

  // ── WRITE ───────────────────────────────────────────────────────────────────

  /**
   * Mark or update a single meal record.
   * Uses upsert so calling it twice doesn't create duplicates.
   */
  async mark(dto: MarkAttendanceDTO): Promise<IAttendanceRecord> {
    const dateObj = startOfDay(new Date(dto.date))

    const record = await AttendanceRecord.findOneAndUpdate(
      { student: dto.student, date: dateObj, mealType: dto.mealType },
      {
        $set: {
          status:   dto.status,
          note:     dto.note ?? null,
          markedAt: dto.status === "Present" ? new Date() : null,
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).populate("student", "student_name student_roll_no student_email")
     .lean()

    invalidateOnWrite([dto.student]).catch(console.error)

    return record as unknown as IAttendanceRecord
  },

  /**
   * Bulk mark — mess staff marks all students for a meal in one call.
   * Uses bulkWrite with upsert for maximum efficiency (one round-trip).
   */
  async bulkMark(dto: BulkMarkDTO): Promise<BulkMarkResponse["data"]> {
    const dateObj = startOfDay(new Date(dto.date))

    const ops = dto.records.map((r) => ({
      updateOne: {
        filter: { student: r.student, date: dateObj, mealType: dto.mealType },
        update: {
          $set: {
            status:   r.status,
            note:     r.note ?? null,
            markedAt: r.status === "Present" ? new Date() : null,
          },
        },
        upsert: true,
      },
    }))

    const result = await AttendanceRecord.bulkWrite(ops, { ordered: false })

    const studentIds = [...new Set(dto.records.map((r) => r.student))]
    invalidateOnWrite(studentIds).catch(console.error)

    return {
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
      total:    dto.records.length,
    }
  },

  /** Update an existing record's status or note */
  async update(id: string, dto: UpdateAttendanceDTO): Promise<IAttendanceRecord> {
    const update: Record<string, any> = {}
    if (dto.status !== undefined) {
      update.status   = dto.status
      update.markedAt = dto.status === "Present" ? new Date() : null
    }
    if (dto.note !== undefined) update.note = dto.note

    const record = await AttendanceRecord.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).populate("student", "student_name student_roll_no student_email")
     .lean()

    if (!record) throw HttpError.notFound(`Attendance record ${id} not found.`)

    invalidateOnWrite([(record as any).student?._id?.toString() ?? ""]).catch(console.error)
    return record as unknown as IAttendanceRecord
  },

  async delete(id: string): Promise<void> {
    const record = await AttendanceRecord.findByIdAndDelete(id).lean()
    if (!record) throw HttpError.notFound(`Attendance record ${id} not found.`)
    invalidateOnWrite([(record as any).student?.toString() ?? ""]).catch(console.error)
  },
}