import { Types } from "mongoose"

// ─── Enums ────────────────────────────────────────────────────────────────────
export type Gender = "male" | "female"
export type ApplicationStatus = "accepted" | "pending" | "rejected" | "approved"

// ─── Core document interface ──────────────────────────────────────────────────
export interface IStudentApplication {
  _id: Types.ObjectId
  student_name: string
  student_email: string
  student_roll_no?: number
  father_name: string
  student_cellphone?: string
  student_reg_no?: string
  father_cellphone?: string
  guardian_name?: string
  guardian_cellphone?: string
  cnic_no?: string
  active_whatsapp_no?: string
  postal_address?: string
  permanent_address?: string
  city?: string
  province?: string
  student_image?: string
  cnic_image?: string[]
  date_of_birth?: string
  academic_year?: string
  gender?: Gender
  status: ApplicationStatus
  application_submit_date: Date
  messEnabled: boolean
  hostelJoinDate?: Date
  hostelLeaveDate?: Date
  isActive?: boolean
  room_id?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/**
 * Fields required / allowed when submitting a new application.
 * IDs, status, and system fields are excluded — the server controls those.
 */
export interface CreateApplicationDTO {
  student_name: string
  student_email: string
  father_name: string
  student_cellphone?: string
  student_reg_no?: string
  father_cellphone?: string
  guardian_name?: string
  guardian_cellphone?: string
  cnic_no?: string
  active_whatsapp_no?: string
  postal_address?: string
  permanent_address?: string
  city?: string
  province?: string
  date_of_birth?: string
  academic_year?: string
  gender?: Gender
  // Image paths are set after upload middleware runs
  student_image?: string
  cnic_image?: string[]
}

/**
 * Admin update — all optional. Status is excluded here; use `UpdateStatusDTO`.
 */
export interface UpdateApplicationDTO {
  student_name?: string
  student_email?: string
  student_roll_no?: number
  father_name?: string
  student_cellphone?: string
  student_reg_no?: string
  father_cellphone?: string
  guardian_name?: string
  guardian_cellphone?: string
  cnic_no?: string
  active_whatsapp_no?: string
  postal_address?: string
  permanent_address?: string
  city?: string
  province?: string
  student_image?: string
  cnic_image?: string[]
  date_of_birth?: string
  academic_year?: string
  gender?: Gender
  hostelJoinDate?: Date
  hostelLeaveDate?: Date
  isActive?: boolean
  room_id?: string
}

/** Dedicated DTO for status transitions. */
export interface UpdateStatusDTO {
  status: ApplicationStatus
  reason?: string
}

/** Toggle mess or active flag. */
export interface ToggleAccessDTO {
  messEnabled?: boolean
  isActive?: boolean
}

/** Assign or unassign a room. */
export interface AssignRoomDTO {
  room_id: string | null
}

// ─── Query / pagination ───────────────────────────────────────────────────────
export interface ApplicationFilters {
  status?: ApplicationStatus
  gender?: Gender
  city?: string
  province?: string
  academic_year?: string
  messEnabled?: boolean
  isActive?: boolean
  search?: string      // matches name, email, roll no, reg no
  page?: number
  limit?: number
  sortBy?: "application_submit_date" | "student_name" | "createdAt"
  sortOrder?: "asc" | "desc"
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Status transition rules ──────────────────────────────────────────────────
export const ALLOWED_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending:  ["accepted", "rejected"],
  accepted: ["approved", "rejected"],
  approved: ["rejected"],             // e.g. re-evaluation
  rejected: ["pending"],              // allow re-application
}