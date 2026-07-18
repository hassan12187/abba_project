import { Document, FlattenMaps, Schema } from "mongoose"

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

export interface INotification extends Document {
    type:string
    message:string
    title:string
    audience:string
    recipient:Schema.Types.ObjectId
    isRead:boolean
    entityId:Schema.Types.ObjectId
    entityType:string
    meta:Schema.Types.Mixed
};