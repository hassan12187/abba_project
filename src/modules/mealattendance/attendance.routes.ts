import { Request, Response, NextFunction } from "express"
import { Router }              from "express"
import { AttendanceService }   from "./attendance.service.js"
import { validate }            from "../../middleware/validate.middleware.js"
import {
  markAttendanceSchema,
  bulkMarkSchema,
  updateAttendanceSchema,
  attendanceFiltersSchema,
  statsFiltersSchema,
  studentSummarySchema,
  idParamSchema,
} from "./attendance.validation.js"
import type { AttendanceFilters } from "./attendance.types.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Controllers ──────────────────────────────────────────────────────────────

/** GET /attendance */
const getAll = asyncHandler(async (req, res) => {
  const filters: AttendanceFilters = {
    date:      req.query.date      as string,
    from:      req.query.from      as string,
    to:        req.query.to        as string,
    mealType:  req.query.mealType  as any,
    status:    req.query.status    as any,
    student:   req.query.student   as string,
    page:      Number(req.query.page)  || 1,
    limit:     Number(req.query.limit) || 50,
    sortOrder:(req.query.sortOrder as any) || "desc",
  }
  const result = await AttendanceService.getAll(filters)
  res.status(200).json(result)
})

/** GET /attendance/:id */
const getById = asyncHandler(async (req, res) => {
  const data = await AttendanceService.getById(req.params.id)
  res.status(200).json({ success: true, data })
})

/**
 * GET /attendance/stats/daily
 * Query: from, to, mealType (all optional)
 * Returns presence counts per day per meal type.
 */
const getDailySummary = asyncHandler(async (req, res) => {
  const { from, to, mealType } = req.query as any
  const now   = new Date()
  const start = from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end   = to   ?? now.toISOString().slice(0, 10)

  const data = await AttendanceService.getDailySummary(start, end, mealType)
  res.status(200).json({ success: true, data })
})

/**
 * GET /attendance/stats/student/:studentId
 * Query: from, to (optional)
 */
const getStudentSummary = asyncHandler(async (req, res) => {
  const { from, to } = req.query as any
  const data = await AttendanceService.getStudentSummary(req.params.studentId, from, to)
  res.status(200).json({ success: true, data })
})

/** POST /attendance — mark single */
const markAttendance = asyncHandler(async (req, res) => {
  const data = await AttendanceService.mark(req.body)
  res.status(201).json({
    success: true,
    message: `${req.body.mealType} attendance marked as ${req.body.status}.`,
    data,
  })
})

/**
 * POST /attendance/bulk
 * Mark all students for a meal in one call.
 * Returns upserted + modified counts.
 */
const bulkMark = asyncHandler(async (req, res) => {
  const data = await AttendanceService.bulkMark(req.body)
  res.status(200).json({
    success: true,
    message: `Bulk mark complete: ${data.upserted} created, ${data.modified} updated.`,
    data,
  })
})

/** PATCH /attendance/:id */
const updateAttendance = asyncHandler(async (req, res) => {
  const data = await AttendanceService.update(req.params.id, req.body)
  res.status(200).json({ success: true, message: "Attendance updated.", data })
})

/** DELETE /attendance/:id */
const deleteAttendance = asyncHandler(async (req, res) => {
  await AttendanceService.delete(req.params.id)
  res.status(200).json({ success: true, message: "Attendance record deleted." })
})

// ─── Router ───────────────────────────────────────────────────────────────────
// Mount as:  app.use("/api/admin/attendance", attendanceRouter)

export const attendanceRouter = Router()

// Stats — must come before /:id to avoid being swallowed as an id param
attendanceRouter.get("/stats/daily",              validate(statsFiltersSchema),   getDailySummary)
attendanceRouter.get("/stats/student/:studentId", validate(studentSummarySchema), getStudentSummary)

// Collection
attendanceRouter.get ("/"       , validate(attendanceFiltersSchema), getAll)
attendanceRouter.post("/"       , validate(markAttendanceSchema),    markAttendance)
attendanceRouter.post("/bulk"   , validate(bulkMarkSchema),          bulkMark)

// Single resource
attendanceRouter.get   ("/:id", validate(idParamSchema),          getById)
attendanceRouter.patch ("/:id", validate(updateAttendanceSchema), updateAttendance)
attendanceRouter.delete("/:id", validate(idParamSchema),          deleteAttendance)