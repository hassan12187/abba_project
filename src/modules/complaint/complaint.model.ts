import { Schema, model } from "mongoose"

// ─── Enums (exported so service/validation can import them) ───────────────────
export const COMPLAINT_PRIORITIES = ["high", "medium", "low"] as const
export const COMPLAINT_CATEGORIES = [
  "electrical", "plumbing", "cleaning", "furniture", "internet", "other",
] as const
export const COMPLAINT_STATUSES = [
  "Pending", "In Progress", "Resolved", "Rejected",
] as const

export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number]
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]
export type ComplaintStatus   = (typeof COMPLAINT_STATUSES)[number]

// ─── Schema ───────────────────────────────────────────────────────────────────
const complaintSchema = new Schema(
  {
    student_id: {
      type:     Schema.Types.ObjectId,
      ref:      "student_application",
      required: [true, "student_id is required"],
    },
    room_id: {
      type:     Schema.Types.ObjectId,
      ref:      "room",
      required: [true, "room_id is required"],
    },
    title: {
      type:      String,
      required:  [true, "title is required"],
      trim:      true,
      minlength: [5,   "title must be at least 5 characters"],
      maxlength: [150, "title must be at most 150 characters"],
    },
    description: {
      type:      String,
      required:  [true, "description is required"],
      trim:      true,
      minlength: [10,   "description must be at least 10 characters"],
      maxlength: [2000, "description must be at most 2000 characters"],
    },
    priority: {
      type:    String,
      enum:    COMPLAINT_PRIORITIES,
      default: "medium",
    },
    category: {
      type:    String,
      enum:    COMPLAINT_CATEGORIES,
      default: "other",
    },
    status: {
      type:    String,
      enum:    COMPLAINT_STATUSES,
      default: "Pending",
    },

    // ── Resolution tracking ────────────────────────────────────────────────
    assigned_to: {
      type:    Schema.Types.ObjectId,
      ref:     "MaintenanceStaff",
      default: null,
    },
    admin_comments: {
      type:      String,
      trim:      true,
      maxlength: 1000,
      default:   null,
    },
    // ISO date when status moved to "Resolved"
    resolved_at: {
      type:    Date,
      default: null,
    },

    // ── Status history (audit trail) ───────────────────────────────────────
    // Every status change is appended here so admins can see the full timeline.
    status_history: [
      {
        status:     { type: String, enum: COMPLAINT_STATUSES, required: true },
        changed_at: { type: Date,   default: Date.now },
        note:       { type: String, trim: true, maxlength: 500 },
        _id:        false,    // no sub-document _id needed
      },
    ],
  },
  {
    timestamps: true,   // replaces manual created_at / updated_at
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
)

// ─── Virtual: resolution time in hours ───────────────────────────────────────
complaintSchema.virtual("resolution_time_hours").get(function () {
  if (!this.resolved_at) return null
  const ms = this.resolved_at.getTime() - (this.createdAt as Date).getTime()
  return Math.round(ms / 36e5)   // ms → hours
})

// ─── Pre-save: auto-set resolved_at on first Resolved transition ──────────────
complaintSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "Resolved" && !this.resolved_at) {
    this.resolved_at = new Date()
  }
  next()
})

// ─── Indexes ──────────────────────────────────────────────────────────────────
complaintSchema.index({ student_id: 1 })
complaintSchema.index({ room_id:    1 })
complaintSchema.index({ status:     1 })
complaintSchema.index({ priority:   1 })
complaintSchema.index({ category:   1 })
complaintSchema.index({ createdAt:  -1 })
complaintSchema.index({ status: 1, priority: -1 })    // for admin dashboard sort

const ComplaintModel = model("Complaint", complaintSchema)
export default ComplaintModel