import express        from "express"
import cors           from "cors"
import helmet         from "helmet"
import cookieParser   from "cookie-parser"
import rateLimit      from "express-rate-limit"
import { createServer } from "http"
import { schedule }   from "node-cron"

// ── Modules ───────────────────────────────────────────────────────────────────
import connectDB               from "./config/connection.js"
import { globalErrorHandler }  from "./middleware/error.middleware.js"
import { authenticate, isAdmin } from "./middleware/Auth.middleware.js"
import { generateMonthlyFees } from "./services/FeeService.js"
import "./services/agenda.js"
import "./queues/emailWorker.js"

// ── Socket (replaces the old manual io export + WebSocketService) ─────────────
import { initSocket } from "./modules/notifications/socket.server.js"

// ── Routers ───────────────────────────────────────────────────────────────────
import { authRouter }          from "./modules/user/user.routes.js"
import { studentRouter }       from "./modules/student/student.routes.js"
import { reportRouter }        from "./modules/reports/report.routes.js"
import { expenseRouter }       from "./modules/expense/expenseRoutes.js"
import { paymentRouter }       from "./modules/payment/payment.routes.js"
import { dashboardRouter }     from "./modules/dashboard/dashboard.routes.js"
import applicationRoute        from "./modules/student.application/studentapplication.routes.js"
import { blockRouter, roomRouter } from "./modules/hostel/hostel.routes.js"
import { complaintRouter }     from "./modules/complaint/complaint.routes.js"
import { attendanceRouter }    from "./modules/mealattendance/attendance.routes.js"
import feeInvoiceRouter        from "./modules/feeInvoice/feeinvoice.routes.js"
import subscriptionRouter      from "./modules/messSubscription/messSubscription.routes.js"
import messMenuRouter          from "./modules/messmenu/messmenu.routes.js"
import { publicApplicationRouter } from "./modules/student.application/publicApplication.routes.js"

// ── Notification routers (new) ────────────────────────────────────────────────
import {
  adminNotificationRouter,
  studentNotificationRouter,
} from "./modules/notifications/notification.routes.js"

// ─────────────────────────────────────────────────────────────────────────────
const app    = express()
const server = createServer(app)   // wrap Express — required for Socket.io

// ── 1. Initialise Socket.io ───────────────────────────────────────────────────
// Must happen before connectDB so getIO() is available in services immediately.
// Your old `export const io = new Server(...)` + WebSocketService() is replaced
// by this one call. The io instance is stored internally and exported via getIO().
const allowedOrigins = [
  process.env.ADMIN_FRONTEND_ORIGIN,
  process.env.STUDENT_PORTAL_FRONTEND_ORIGIN,
].filter(Boolean) as string[]

initSocket(server, allowedOrigins)   // see note below about the signature tweak

// ── 2. Security / parsing ─────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true)
    else cb(new Error("Not allowed by CORS"))
  },
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

// ── 3. Public auth routes ─────────────────────────────────────────────────────
app.use("/api/auth", authRouter)

// ── 4. Student portal ─────────────────────────────────────────────────────────
app.use("/api/student",                studentRouter)
app.use("/api/student/notifications",  studentNotificationRouter)   // ← new

// ── 5. Admin routes (all protected by authenticate + isAdmin) ─────────────────
app.use("/api/applications",publicApplicationRouter)

app.use("/api/admin", authenticate, isAdmin)

app.use("/api/admin/notifications",  adminNotificationRouter)        // ← new
app.use("/api/admin/report",         reportRouter)
app.use("/api/admin/report",         expenseRouter)
// app.use("/api/admin/report",         dashboardRouter)
app.use("/api/admin/payments",       paymentRouter)
app.use("/api/admin/applications",   applicationRoute)
app.use("/api/admin/blocks",         blockRouter)
app.use("/api/admin/rooms",          roomRouter)
app.use("/api/admin/complaints",     complaintRouter)
app.use("/api/admin/attendance",     attendanceRouter)
app.use("/api/admin/invoices",       feeInvoiceRouter)
app.use("/api/admin/expenses",      expenseRouter)
app.use("/api/admin/subscriptions",  subscriptionRouter)
app.use("/api/admin/mess-menu",      messMenuRouter)

// ── 6. 404 + global error handler (must be last) ──────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." })
})
app.use(globalErrorHandler)

// ── 7. Cron: generate monthly fee invoices ────────────────────────────────────
schedule("0 0 1 * *", async () => {
  const now = new Date()
  await generateMonthlyFees(now.getFullYear(), now.getMonth() + 1)
})

// ── 8. Connect DB then start listening ───────────────────────────────────────
connectDB().then(() => {
  server.listen(process.env.PORT, () => {
    console.log(`🚀  Server + Socket.io running on port ${process.env.PORT}`)
  })
})