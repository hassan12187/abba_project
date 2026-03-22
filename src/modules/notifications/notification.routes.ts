import { Request, Response, NextFunction, Router } from "express"
import { NotificationService } from "./notification.services.js"
import { authenticate, requireRole, requireApplicationId } from "../../middleware/Auth.middleware.js"
import { validate } from "../../middleware/validate.middleware.js"
import { z } from "zod"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

const objectId     = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
const filtersSchema = z.object({
  query: z.object({
    isRead: z.enum(["true","false"]).transform(v => v === "true").optional(),
    type:   z.string().optional(),
    page:   z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:  z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("20"),
  }),
})

// ─── Admin notification controllers ───────────────────────────────────────────

/** GET /notifications — admin: get all admin-audience notifications */
const getAdminNotifications = asyncHandler(async (req, res) => {
  const { isRead, type, page, limit } = req.query as any
  const result = await NotificationService.getAdminNotifications({
    isRead: isRead === "true" ? true : isRead === "false" ? false : undefined,
    type,
    page:  Number(page)  || 1,
    limit: Number(limit) || 20,
  })
  res.status(200).json({ success: true, ...result })
})

/** PATCH /notifications/mark-read — admin: mark all as read */
const markAllAdminRead = asyncHandler(async (_req, res) => {
  const modified = await NotificationService.markAllAdminRead()
  res.status(200).json({ success: true, message: `${modified} notification(s) marked as read.` })
})

/** PATCH /notifications/:id/read — mark single as read */
const markOneRead = asyncHandler(async (req, res) => {
  const notification = await NotificationService.markOneRead(req.params.id)
  if (!notification) {
    res.status(404).json({ success: false, message: "Notification not found." })
    return
  }
  res.status(200).json({ success: true, data: notification })
})

/** DELETE /notifications/:id */
const deleteOne = asyncHandler(async (req, res) => {
  await NotificationService.deleteOne(req.params.id)
  res.status(200).json({ success: true, message: "Notification deleted." })
})

/** DELETE /notifications — admin: clear all */
const clearAll = asyncHandler(async (_req, res) => {
  await NotificationService.clearAllAdmin()
  res.status(200).json({ success: true, message: "All notifications cleared." })
})

// ─── Student notification controllers ─────────────────────────────────────────

/** GET /student/notifications */
const getStudentNotifications = asyncHandler(async (req, res) => {
  const { isRead, page, limit } = req.query as any
  const result = await NotificationService.getStudentNotifications(req.user!.sub, {
    isRead: isRead === "true" ? true : isRead === "false" ? false : undefined,
    page:  Number(page)  || 1,
    limit: Number(limit) || 20,
  })
  res.status(200).json({ success: true, ...result })
})

/** PATCH /student/notifications/mark-read */
const markAllStudentRead = asyncHandler(async (req, res) => {
  const modified = await NotificationService.markAllStudentRead(req.user!.sub)
  res.status(200).json({ success: true, message: `${modified} notification(s) marked as read.` })
})

/** DELETE /student/notifications */
const clearStudentAll = asyncHandler(async (req, res) => {
  await NotificationService.clearAllStudent(req.user!.sub)
  res.status(200).json({ success: true, message: "Notifications cleared." })
})

// ─── Admin router ─────────────────────────────────────────────────────────────
// Mount as: app.use("/api/admin/notifications", authenticate, isAdmin, adminNotificationRouter)
export const adminNotificationRouter = Router()

adminNotificationRouter.get   ("/",              validate(filtersSchema),              getAdminNotifications)
adminNotificationRouter.patch ("/mark-read",     markAllAdminRead)
adminNotificationRouter.patch ("/:id/read",      validate(z.object({ params: z.object({ id: objectId }) })), markOneRead)
adminNotificationRouter.delete("/",              clearAll)
adminNotificationRouter.delete("/:id",           validate(z.object({ params: z.object({ id: objectId }) })), deleteOne)

// ─── Student router ───────────────────────────────────────────────────────────
// Mount as: app.use("/api/student/notifications", authenticate, isStudent, studentNotificationRouter)
export const studentNotificationRouter = Router()

studentNotificationRouter.get   ("/",          validate(filtersSchema),    getStudentNotifications)
studentNotificationRouter.patch ("/mark-read", markAllStudentRead)
studentNotificationRouter.delete("/",          clearStudentAll)