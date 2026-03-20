import type {
  ComplaintPriority,
  ComplaintCategory,
  ComplaintStatus,
} from "./complaint.model.js"

export type { ComplaintPriority, ComplaintCategory, ComplaintStatus }

// ─── Populated shapes ─────────────────────────────────────────────────────────
export interface ComplaintStudent {
  _id:             string
  student_name:    string
  student_roll_no: string | number
  student_email:   string
}

export interface ComplaintRoom {
  _id:     string
  room_no: string
  floor?:  string
  block?:  string
}

export interface StatusHistoryEntry {
  status:     ComplaintStatus
  changed_at: string
  note?:      string
}

export interface Complaint {
  _id:                   string
  student_id:            ComplaintStudent
  room_id:               ComplaintRoom
  title:                 string
  description:           string
  priority:              ComplaintPriority
  category:              ComplaintCategory
  status:                ComplaintStatus
  assigned_to?:          string | null
  admin_comments?:       string | null
  resolved_at?:          string | null
  resolution_time_hours?:number | null
  status_history:        StatusHistoryEntry[]
  createdAt:             string
  updatedAt:             string
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** Body for POST /complaints — admin creates on behalf of student */
export interface CreateComplaintDTO {
  student_id:   string
  room_id:      string
  title:        string
  description:  string
  priority?:    ComplaintPriority
  category?:    ComplaintCategory
}

/** Body for PATCH /complaints/:id/status */
export interface UpdateStatusDTO {
  status:          ComplaintStatus
  admin_comments?: string
  note?:           string   // appended to status_history
}

/** Body for PATCH /complaints/:id */
export interface UpdateComplaintDTO {
  title?:          string
  description?:    string
  priority?:       ComplaintPriority
  category?:       ComplaintCategory
  assigned_to?:    string | null
  admin_comments?: string
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface ComplaintFilters {
  status?:    ComplaintStatus | "All"
  priority?:  ComplaintPriority
  category?:  ComplaintCategory
  search?:    string          // matches title
  from?:      string          // YYYY-MM-DD
  to?:        string          // YYYY-MM-DD
  page?:      number
  limit?:     number
  sortBy?:    "createdAt" | "updatedAt" | "priority"
  sortOrder?: "asc" | "desc"
}

// ─── API response wrappers ────────────────────────────────────────────────────
export interface PaginatedComplaintsResponse {
  success:    boolean
  data:       Complaint[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

export interface SingleComplaintResponse {
  success:  boolean
  data:     Complaint
  message?: string
}

export interface ComplaintStatsResponse {
  success: boolean
  data: {
    byStatus:   Record<ComplaintStatus,   number>
    byPriority: Record<ComplaintPriority, number>
    byCategory: Record<ComplaintCategory, number>
    total:              number
    avgResolutionHours: number | null
    pendingHighPriority:number
  }
}