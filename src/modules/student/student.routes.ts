import { Request, Response, NextFunction, Router } from "express"
import { authenticate, requireRole, requireApplicationId } from "../../middleware/Auth.middleware.js"
import { StudentInvoiceService }   from "../feeInvoice/feeinvoice.student.service.js"
import { ComplaintService }        from "../complaint/complaint.services.js"
import { AttendanceService }       from "../mealattendance/attendance.service.js"
import studentApplicationModel     from "../student.application/studentApplicationModel.js"
import  MessSubscriptionModel    from "../messSubscription/MessSubscription.model.js"
import { validate }                from "../../middleware/validate.middleware.js"
import { z }                       from "zod"
import { HttpError }               from "../../utils/errors.js"

// ─── Zod helpers ──────────────────────────────────────────────────────────────
const objectId  = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
const isoDate   = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Middleware stack every student route uses ────────────────────────────────
// authenticate  → verifies JWT
// isStudent     → ensures role === STUDENT
// requireAppId  → ensures applicationId is in the token
const isStudent   = requireRole("STUDENT")
const requireApp  = requireApplicationId

// Shorthand: get the application _id from the JWT (always a string at this point)
const appId = (req: Request) => req.user!.applicationId!

// ─── Student portal router ────────────────────────────────────────────────────
// Mount as:  app.use("/api/student", studentRouter)
export const studentRouter = Router()

// All routes in this file require a valid student session + linked application
studentRouter.use(authenticate, isStudent, requireApp)

// ──────────────────────────────────────────────────────────────────────────────
// PROFILE
// GET /student/profile  — full application data (room, status, mess enabled, etc.)
// ──────────────────────────────────────────────────────────────────────────────
studentRouter.get("/profile", asyncHandler(async (req, res) => {
  const profile = await studentApplicationModel
    .findById(appId(req))
    .populate("room_id", "room_no floor block fees capacity")
    .lean()

  if (!profile) throw HttpError.notFound("Profile not found.")
  res.status(200).json({ success: true, data: profile })
}))

// ──────────────────────────────────────────────────────────────────────────────
// FEE INVOICES
// GET  /student/invoices          — paginated list of own invoices
// GET  /student/invoices/summary  — dashboard summary card
// GET  /student/invoices/:id      — single invoice (ownership-checked)
// ──────────────────────────────────────────────────────────────────────────────
studentRouter.get("/invoices/summary", asyncHandler(async (req, res) => {
  const data = await StudentInvoiceService.getMySummary(appId(req))
  res.status(200).json({ success: true, data })
}))

studentRouter.get("/invoices", validate(z.object({
  query: z.object({
    status:       z.string().optional(),
    billingMonth: z.string().optional(),
    page:         z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:        z.string().transform(Number).pipe(z.number().int().min(1).max(50)).optional().default("10"),
  }),
})), asyncHandler(async (req, res) => {
  const { status, billingMonth, page, limit } = req.query as any
  const result = await StudentInvoiceService.getMyInvoices(appId(req), {
    status, billingMonth,
    page:  Number(page)  || 1,
    limit: Number(limit) || 10,
  })
  res.status(200).json({ success: true, ...result })
}))

studentRouter.get("/invoices/:id", validate(z.object({ params: z.object({ id: objectId }) })),
  asyncHandler(async (req, res) => {
    const data = await StudentInvoiceService.getMyInvoiceById(req.params.id, appId(req))
    res.status(200).json({ success: true, data })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// COMPLAINTS
// GET  /student/complaints        — own complaints, paginated
// GET  /student/complaints/:id    — single complaint (ownership-checked)
// POST /student/complaints        — submit a new complaint
// ──────────────────────────────────────────────────────────────────────────────
studentRouter.get("/complaints", validate(z.object({
  query: z.object({
    status:    z.string().optional(),
    category:  z.string().optional(),
    page:      z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:     z.string().transform(Number).pipe(z.number().int().min(1).max(50)).optional().default("10"),
    sortOrder: z.enum(["asc","desc"]).optional().default("desc"),
  }),
})), asyncHandler(async (req, res) => {
  const { status, category, page, limit, sortOrder } = req.query as any
  const result = await ComplaintService.getAll({
    // Force filter to this student's applicationId — they can NEVER see others' complaints
    student_id: appId(req) as any,
    status,
    category,
    page:  Number(page)  || 1,
    limit: Number(limit) || 10,
    sortOrder,
  } as any)
  res.status(200).json({ success: true, ...result })
}))

studentRouter.get("/complaints/:id", validate(z.object({ params: z.object({ id: objectId }) })),
  asyncHandler(async (req, res) => {
    const complaint = await ComplaintService.getById(req.params.id)
    // Ownership check — student can only see their own complaint
    if ((complaint.student_id as any)?._id?.toString() !== appId(req) &&
        (complaint.student_id as any)?.toString()      !== appId(req)) {
      throw HttpError.forbidden("You do not have access to this complaint.")
    }
    res.status(200).json({ success: true, data: complaint })
  })
)

studentRouter.post("/complaints", validate(z.object({
  body: z.object({
    title:       z.string().min(5).max(150).trim(),
    description: z.string().min(10).max(2000).trim(),
    priority:    z.enum(["high","medium","low"]).optional(),
    category:    z.enum(["electrical","plumbing","cleaning","furniture","internet","other"]).optional(),
  }),
})), asyncHandler(async (req, res) => {
  // Get the student's room from their application
  const application = await studentApplicationModel
    .findById(appId(req))
    .select("room_id")
    .lean()

  if (!application?.room_id) {
    throw HttpError.badRequest("You must be assigned a room before submitting a complaint.")
  }

  const data = await ComplaintService.create({
    student_id:  appId(req),
    room_id:     application.room_id.toString(),
    title:       req.body.title,
    description: req.body.description,
    priority:    req.body.priority,
    category:    req.body.category,
  })

  res.status(201).json({ success: true, message: "Complaint submitted.", data })
}))

// ──────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// GET /student/attendance          — own meal attendance records
// GET /student/attendance/summary  — overall attendance % per meal type
// ──────────────────────────────────────────────────────────────────────────────
studentRouter.get("/attendance/summary", validate(z.object({
  query: z.object({
    from: isoDate.optional(),
    to:   isoDate.optional(),
  }),
})), asyncHandler(async (req, res) => {
  const { from, to } = req.query as any
  const data = await AttendanceService.getStudentSummary(appId(req), from, to)
  res.status(200).json({ success: true, data })
}))

studentRouter.get("/attendance", validate(z.object({
  query: z.object({
    date:     isoDate.optional(),
    from:     isoDate.optional(),
    to:       isoDate.optional(),
    mealType: z.enum(["Breakfast","Lunch","Dinner"]).optional(),
    status:   z.enum(["Present","Absent","Leave"]).optional(),
    page:     z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:    z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("30"),
  }),
})), asyncHandler(async (req, res) => {
  const { date, from, to, mealType, status, page, limit } = req.query as any
  const result = await AttendanceService.getAll({
    student: appId(req),   // force to own records
    date, from, to, mealType, status,
    page:  Number(page)  || 1,
    limit: Number(limit) || 30,
  })
  res.status(200).json({ success: true, ...result })
}))

// ──────────────────────────────────────────────────────────────────────────────
// MESS SUBSCRIPTION
// GET /student/subscription  — own active subscription
// ──────────────────────────────────────────────────────────────────────────────
studentRouter.get("/subscription", asyncHandler(async (req, res) => {
  // Import dynamically to match the pattern used in the rest of the codebase
  const MessSubscription = (await import("../messSubscription/messSubscription.model.js")).default

  const subscription = await MessSubscription
    .findOne({ student: appId(req) })
    .sort({ createdAt: -1 })
    .lean()

  res.status(200).json({ success: true, data: subscription ?? null })
}))

// ──────────────────────────────────────────────────────────────────────────────
// DASHBOARD  (aggregates all the above into one call)
// GET /student/dashboard
// ──────────────────────────────────────────────────────────────────────────────
studentRouter.get("/dashboard", asyncHandler(async (req, res) => {
  const studentId = appId(req)
  const today     = new Date().toISOString().slice(0, 10)

  const [profile, invoiceSummary, openComplaints, todayAttendance, subscription] = await Promise.all([

    // Basic profile + room info
    studentApplicationModel
      .findById(studentId)
      .populate("room_id", "room_no floor block fees")
      .select("student_name student_roll_no student_email status messEnabled room_id hostelJoinDate")
      .lean(),

    // Fee summary card
    StudentInvoiceService.getMySummary(studentId),

    // Count open (non-resolved) complaints
    ComplaintService.getAll({
      student_id: studentId as any,
      status: "Pending",
      page: 1, limit: 1,
    } as any),

    // Today's meal attendance
    AttendanceService.getAll({
      student: studentId,
      date:    today,
      limit:   3,
    }),

    // Active mess subscription
    (async () => {
      const MessSubscription = (await import("../messSubscription/messSubscription.model.js")).default
      return MessSubscription.findOne({ student: studentId, status: "Active" })
        .select("planType monthlyFee validUntil status")
        .lean()
    })(),
  ])

  res.status(200).json({
    success: true,
    data: {
      profile,
      fees: invoiceSummary,
      complaints: {
        pendingCount: openComplaints.total,
      },
      attendance: {
        today: todayAttendance.data,
      },
      subscription,
    },
  })
}))