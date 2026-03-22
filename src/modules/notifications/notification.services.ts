import NotificationModel, { NotificationType, NotificationAudience } from "./notificaton.model.js"
import { getIO, ROOMS } from "./socket.server.js"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CreateNotificationDTO {
  type:        NotificationType
  title:       string
  message:     string
  audience:    NotificationAudience
  recipient?:  string | null   // specific user _id — for student notifications
  entityId?:   string | null   // e.g. application._id
  entityType?: string | null   // e.g. "application"
  meta?:       Record<string, any>
}

export interface NotificationFilters {
  isRead?:   boolean
  type?:     NotificationType
  page?:     number
  limit?:    number
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const NotificationService = {

  // ── CREATE + EMIT ──────────────────────────────────────────────────────────

  /**
   * Persist a notification to MongoDB AND emit it via Socket.io.
   * This is the single entry point — call it from any service after an event.
   *
   * Examples:
   *   NotificationService.create({ type:"new_application", audience:"admin", ... })
   *   NotificationService.create({ type:"room_assigned",   audience:"student", recipient: userId, ... })
   */
  async create(dto: CreateNotificationDTO) {
    // 1. Persist to DB
    const notification = await NotificationModel.create({
      type:       dto.type,
      title:      dto.title,
      message:    dto.message,
      audience:   dto.audience,
      recipient:  dto.recipient   ?? null,
      entityId:   dto.entityId   ?? null,
      entityType: dto.entityType ?? null,
      meta:       dto.meta       ?? {},
    })

    // 2. Emit via Socket.io (fire-and-forget — never block the API response)
    try {
      const io = getIO()
      const payload = notification.toObject()

      if (dto.audience === "admin" || dto.audience === "all") {
        // Broadcast to all connected admins
        io.to(ROOMS.admins).emit("notification", payload)
      }

      if (
        (dto.audience === "student" || dto.audience === "all") &&
        dto.recipient
      ) {
        // Send only to the specific student's socket room
        io.to(ROOMS.student(dto.recipient)).emit("notification", payload)
      }
    } catch {
      // Socket not initialised in test/CI environments — silently skip
    }

    return notification
  },

  // ── READ ───────────────────────────────────────────────────────────────────

  /** Admin: get all admin-audience notifications, newest first */
  async getAdminNotifications(filters: NotificationFilters) {
    const { isRead, type, page = 1, limit = 20 } = filters

    const query: Record<string, any> = { audience: "admin" }
    if (isRead  !== undefined) query.isRead = isRead
    if (type)                  query.type   = type

    const skip = (page - 1) * limit

    const [data, total, unreadCount] = await Promise.all([
      NotificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(query),
      NotificationModel.countDocuments({ audience: "admin", isRead: false }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit), unreadCount }
  },

  /** Student: get notifications for a specific user */
  async getStudentNotifications(userId: string, filters: NotificationFilters) {
    const { isRead, page = 1, limit = 20 } = filters

    const query: Record<string, any> = { recipient: userId }
    if (isRead !== undefined) query.isRead = isRead

    const skip = (page - 1) * limit

    const [data, total, unreadCount] = await Promise.all([
      NotificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(query),
      NotificationModel.countDocuments({ recipient: userId, isRead: false }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit), unreadCount }
  },

  // ── MARK READ ──────────────────────────────────────────────────────────────

  /** Mark all unread admin notifications as read */
  async markAllAdminRead() {
    const result = await NotificationModel.updateMany(
      { audience: "admin", isRead: false },
      { $set: { isRead: true } }
    )
    return result.modifiedCount
  },

  /** Mark all unread notifications for a specific student as read */
  async markAllStudentRead(userId: string) {
    const result = await NotificationModel.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    )
    return result.modifiedCount
  },

  /** Mark a single notification as read */
  async markOneRead(id: string) {
    return NotificationModel.findByIdAndUpdate(
      id,
      { $set: { isRead: true } },
      { new: true }
    )
  },

  // ── DELETE ─────────────────────────────────────────────────────────────────

  async deleteOne(id: string) {
    return NotificationModel.findByIdAndDelete(id)
  },

  async clearAllAdmin() {
    return NotificationModel.deleteMany({ audience: "admin" })
  },

  async clearAllStudent(userId: string) {
    return NotificationModel.deleteMany({ recipient: userId })
  },
}

// ─── Convenience factory functions ───────────────────────────────────────────
// Call these from other services — no need to remember the DTO shape.

export const Notify = {

  /** A student submitted a new application */
  newApplication(data: { studentName: string; applicationId: string }) {
    return NotificationService.create({
      type:       "new_application",
      audience:   "admin",
      title:      "New Application",
      message:    `${data.studentName} submitted a hostel application.`,
      entityId:   data.applicationId,
      entityType: "application",
      meta:       { studentName: data.studentName },
    })
  },

  /** Admin accepted an application */
  applicationAccepted(data: { studentName: string; applicationId: string; recipientUserId: string }) {
    return NotificationService.create({
      type:       "application_accepted",
      audience:   "student",
      recipient:  data.recipientUserId,
      title:      "Application Accepted",
      message:    "Your hostel application has been accepted. Await final approval.",
      entityId:   data.applicationId,
      entityType: "application",
    })
  },

  /** Admin fully approved an application */
  applicationApproved(data: { studentName: string; applicationId: string; recipientUserId: string }) {
    return NotificationService.create({
      type:       "application_approved",
      audience:   "student",
      recipient:  data.recipientUserId,
      title:      "Application Approved 🎉",
      message:    "Congratulations! Your hostel application has been fully approved.",
      entityId:   data.applicationId,
      entityType: "application",
    })
  },

  /** Admin rejected an application */
  applicationRejected(data: { reason?: string; applicationId: string; recipientUserId: string }) {
    return NotificationService.create({
      type:       "application_rejected",
      audience:   "student",
      recipient:  data.recipientUserId,
      title:      "Application Rejected",
      message:    data.reason
        ? `Your application was rejected: ${data.reason}`
        : "Your hostel application has been rejected. Contact admin for details.",
      entityId:   data.applicationId,
      entityType: "application",
    })
  },

  /** Room assigned to a student */
  roomAssigned(data: { roomNo: string; applicationId: string; recipientUserId: string }) {
    return NotificationService.create({
      type:       "room_assigned",
      audience:   "student",
      recipient:  data.recipientUserId,
      title:      "Room Assigned",
      message:    `You have been assigned Room ${data.roomNo}.`,
      entityId:   data.applicationId,
      entityType: "application",
      meta:       { roomNo: data.roomNo },
    })
  },

  /** Fee invoice generated for a student */
  invoiceGenerated(data: {
    invoiceNumber: string; amount: number
    invoiceId: string; recipientUserId: string
  }) {
    return NotificationService.create({
      type:       "invoice_generated",
      audience:   "student",
      recipient:  data.recipientUserId,
      title:      "New Fee Invoice",
      message:    `Invoice ${data.invoiceNumber} for ₹${data.amount.toLocaleString("en-IN")} has been generated.`,
      entityId:   data.invoiceId,
      entityType: "invoice",
      meta:       { invoiceNumber: data.invoiceNumber, amount: data.amount },
    })
  },

  /** Payment received — notify admin */
  paymentReceived(data: { studentName: string; amount: number; paymentId: string }) {
    return NotificationService.create({
      type:       "payment_received",
      audience:   "admin",
      title:      "Payment Received",
      message:    `₹${data.amount.toLocaleString("en-IN")} payment received from ${data.studentName}.`,
      entityId:   data.paymentId,
      entityType: "payment",
      meta:       { studentName: data.studentName, amount: data.amount },
    })
  },

  /** Student filed a complaint */
  complaintSubmitted(data: { studentName: string; title: string; complaintId: string }) {
    return NotificationService.create({
      type:       "complaint_submitted",
      audience:   "admin",
      title:      "New Complaint",
      message:    `${data.studentName} filed a complaint: "${data.title}"`,
      entityId:   data.complaintId,
      entityType: "complaint",
      meta:       { studentName: data.studentName, complaintTitle: data.title },
    })
  },

  /** Admin resolved a complaint */
  complaintResolved(data: { complaintTitle: string; complaintId: string; recipientUserId: string }) {
    return NotificationService.create({
      type:       "complaint_resolved",
      audience:   "student",
      recipient:  data.recipientUserId,
      title:      "Complaint Resolved",
      message:    `Your complaint "${data.complaintTitle}" has been resolved.`,
      entityId:   data.complaintId,
      entityType: "complaint",
    })
  },

  /** Mess subscription expiring soon */
  subscriptionExpiring(data: {
    daysLeft: number; recipientUserId: string; subscriptionId: string
  }) {
    return NotificationService.create({
      type:       "subscription_expiring",
      audience:   "student",
      recipient:  data.recipientUserId,
      title:      "Mess Subscription Expiring",
      message:    `Your mess subscription expires in ${data.daysLeft} day${data.daysLeft !== 1 ? "s" : ""}. Renew to avoid interruption.`,
      entityId:   data.subscriptionId,
      entityType: "subscription",
      meta:       { daysLeft: data.daysLeft },
    })
  },
}