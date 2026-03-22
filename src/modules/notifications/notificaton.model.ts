import { Schema, model } from "mongoose"

// ─── Enums ────────────────────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  "new_application",      // student submitted application
  "application_accepted", // admin accepted application
  "application_approved", // admin fully approved
  "application_rejected", // admin rejected
  "payment_received",     // fee payment collected
  "complaint_submitted",  // student filed complaint
  "complaint_resolved",   // complaint marked resolved
  "invoice_generated",    // new invoice created for student
  "subscription_expiring",// mess subscription expiring soon
  "room_assigned",        // room assigned to student
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// Who should see this notification
export const NOTIFICATION_AUDIENCES = ["admin", "student", "all"] as const
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number]

// ─── Schema ───────────────────────────────────────────────────────────────────
const notificationSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     NOTIFICATION_TYPES,
      required: [true, "Notification type is required"],
      index:    true,
    },

    // Human-readable message shown in the UI
    message: {
      type:     String,
      required: [true, "Message is required"],
      trim:     true,
      maxlength: 500,
    },

    // Short title shown in the notification bell
    title: {
      type:     String,
      required: [true, "Title is required"],
      trim:     true,
      maxlength: 100,
    },

    // Who should receive this notification
    audience: {
      type:    String,
      enum:    NOTIFICATION_AUDIENCES,
      default: "admin",
    },

    // If audience === "student" — the specific student who should see it
    // If null with audience === "admin" — all admins see it
    recipient: {
      type:    Schema.Types.ObjectId,
      ref:     "user",
      default: null,
      index:   true,
    },

    // Whether the recipient has read it
    isRead: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    // Reference to the entity that triggered this notification
    // e.g. the application_id, invoice_id, complaint_id
    entityId: {
      type:    Schema.Types.ObjectId,
      default: null,
    },

    // e.g. "application", "invoice", "complaint" — for building deep-link URLs
    entityType: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Extra payload — e.g. { student_name, room_no } for richer messages
    meta: {
      type:    Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,   // createdAt is the notification timestamp
  }
)

// ── Compound indexes for common queries ───────────────────────────────────────
notificationSchema.index({ audience: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 })

// ── TTL: auto-delete notifications older than 30 days ────────────────────────
// This keeps the collection lean without manual cleanup jobs.
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
)

const NotificationModel = model("notification", notificationSchema)
export default NotificationModel