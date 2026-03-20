import { FilterQuery, SortOrder } from "mongoose"
import studentApplicationModel from "./studentApplicationModel.js"
import {
  IStudentApplication,
  CreateApplicationDTO,
  UpdateApplicationDTO,
  UpdateStatusDTO,
  ToggleAccessDTO,
  AssignRoomDTO,
  ApplicationFilters,
  PaginatedResult,
  ApplicationStatus,
  ALLOWED_STATUS_TRANSITIONS,
} from "./types.js";
import { HttpError } from "../../utils/errors.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fields we always populate for rich responses */
const ROOM_POPULATE = { path: "room_id", select: "room_number floor block capacity" }

// ─── Service ──────────────────────────────────────────────────────────────────

export const StudentApplicationService = {
  /**
   * Submit a new student application.
   * Enforces one-application-per-email at the service layer
   * (schema has unique index, but we give a better error message here).
   */
  async create(dto: CreateApplicationDTO): Promise<IStudentApplication> {
    const existing = await studentApplicationModel
      .findOne({ student_email: dto.student_email })
      .lean()

    if (existing) {
      throw HttpError.conflict(
        `An application with email '${dto.student_email}' already exists.`
      )
    }

    const application = await studentApplicationModel.create(dto)
    return application.toObject() as IStudentApplication
  },

  /**
   * Fetch a single application by its ID with room details populated.
   */
  async getById(id: string): Promise<IStudentApplication> {
    const application = await studentApplicationModel
      .findById(id)
      .populate(ROOM_POPULATE)
      .lean()

    if (!application) {
      throw HttpError.notFound(`Application with id '${id}' not found.`)
    }

    return application as IStudentApplication
  },

  /**
   * Fetch application by email — used for student self-lookup.
   */
  async getByEmail(email: string): Promise<IStudentApplication> {
    const application = await studentApplicationModel
      .findOne({ student_email: email.toLowerCase() })
      .populate(ROOM_POPULATE)
      .lean()

    if (!application) {
      throw HttpError.notFound(`No application found for email '${email}'.`)
    }

    return application as IStudentApplication
  },

  /**
   * Paginated list with rich filtering and sorting.
   */
  async getAll(filters: ApplicationFilters): Promise<PaginatedResult<IStudentApplication>> {
    const {
      status,
      gender,
      city,
      province,
      academic_year,
      messEnabled,
      isActive,
      search,
      page  = 1,
      limit = 10,
      sortBy    = "createdAt",
      sortOrder = "desc",
    } = filters

    const query: FilterQuery<IStudentApplication> = {}

    if (status)        query.status        = status
    if (gender)        query.gender        = gender
    if (city)          query.city          = { $regex: city, $options: "i" }
    if (province)      query.province      = { $regex: province, $options: "i" }
    if (academic_year) query.academic_year = academic_year
    if (messEnabled !== undefined) query.messEnabled = messEnabled
    if (isActive    !== undefined) query.isActive    = isActive

    // Full-text style search across multiple fields
    if (search) {
      const rx = { $regex: search, $options: "i" }
      query.$or = [
        { student_name:  rx },
        { student_email: rx },
        { student_reg_no:rx },
        { city:          rx },
        ...(isNaN(Number(search))
          ? []
          : [{ student_roll_no: Number(search) }]),
      ]
    }

    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder === "asc" ? 1 : -1 }
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      studentApplicationModel
        .find(query)
        .populate(ROOM_POPULATE)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      studentApplicationModel.countDocuments(query),
    ])

    return {
      data:       data as IStudentApplication[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  /**
   * Admin update — general fields only.
   * Status changes go through `updateStatus`.
   */
  async update(id: string, dto: UpdateApplicationDTO): Promise<IStudentApplication> {
    // Prevent status slipping in through the general update
    if ("status" in dto) {
      throw HttpError.badRequest(
        "Use PATCH /applications/:id/status to change application status."
      )
    }

    // Prevent duplicate email if changing it
    if (dto.student_email) {
      const conflict = await studentApplicationModel.findOne({
        student_email: dto.student_email,
        _id: { $ne: id },
      })
      if (conflict) {
        throw HttpError.conflict(
          `Email '${dto.student_email}' is already in use by another application.`
        )
      }
    }

    const updated = await studentApplicationModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .populate(ROOM_POPULATE)
      .lean()

    if (!updated) throw HttpError.notFound(`Application with id '${id}' not found.`)

    return updated as IStudentApplication
  },

  /**
   * Controlled status transition with guard rails.
   * Enforces the ALLOWED_STATUS_TRANSITIONS table.
   */
  async updateStatus(id: string, dto: UpdateStatusDTO): Promise<IStudentApplication> {
    const application = await studentApplicationModel.findById(id)

    if (!application) throw HttpError.notFound(`Application with id '${id}' not found.`)

    const current = application.status as ApplicationStatus
    const next    = dto.status

    if (current === next) {
      throw HttpError.badRequest(`Application is already '${next}'.`)
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[current]
    if (!allowed.includes(next)) {
      throw HttpError.badRequest(
        `Cannot transition from '${current}' to '${next}'. ` +
        `Allowed: ${allowed.length ? allowed.join(", ") : "none"}.`
      )
    }

    application.status = next
    await application.save()

    return application.toObject() as IStudentApplication
  },

  /**
   * Toggle mess access or active flag (or both).
   */
  async toggleAccess(id: string, dto: ToggleAccessDTO): Promise<IStudentApplication> {
    // Mess can only be enabled for approved students
    if (dto.messEnabled === true) {
      const doc = await studentApplicationModel.findById(id).select("status")
      if (!doc) throw HttpError.notFound(`Application with id '${id}' not found.`)
      if (doc.status !== "approved") {
        throw HttpError.forbidden(
          "Mess access can only be enabled for 'approved' students."
        )
      }
    }

    const updated = await studentApplicationModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .populate(ROOM_POPULATE)
      .lean()

    if (!updated) throw HttpError.notFound(`Application with id '${id}' not found.`)

    return updated as IStudentApplication
  },

  /**
   * Assign or unassign a room.
   * room_id: null → unassign.
   */
  async assignRoom(id: string, dto: AssignRoomDTO): Promise<IStudentApplication> {
    const application = await studentApplicationModel.findById(id).select("status")
    if (!application) throw HttpError.notFound(`Application with id '${id}' not found.`)

    if (dto.room_id && application.status !== "approved") {
      throw HttpError.forbidden("Rooms can only be assigned to 'approved' students.")
    }

    const update = dto.room_id
      ? { $set:   { room_id: dto.room_id } }
      : { $unset: { room_id: "" } }

    const updated = await studentApplicationModel
      .findByIdAndUpdate(id, update, { new: true })
      .populate(ROOM_POPULATE)
      .lean()

    if (!updated) throw HttpError.notFound(`Application with id '${id}' not found.`)

    return updated as IStudentApplication
  },

  /**
   * Bulk status update — admin shortcut for approving/rejecting multiple applications.
   */
  async bulkUpdateStatus(
    ids: string[],
    status: ApplicationStatus,
    reason?: string
  ): Promise<{ modifiedCount: number; failedIds: string[] }> {
    const applications = await studentApplicationModel
      .find({ _id: { $in: ids } })
      .select("_id status")

    const eligibleIds: string[] = []
    const failedIds:   string[] = []

    for (const app of applications) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[app.status as ApplicationStatus]
      if (allowed.includes(status)) {
        eligibleIds.push(app._id.toString())
      } else {
        failedIds.push(app._id.toString())
      }
    }

    let modifiedCount = 0
    if (eligibleIds.length > 0) {
      const result = await studentApplicationModel.updateMany(
        { _id: { $in: eligibleIds } },
        { $set: { status } }
      )
      modifiedCount = result.modifiedCount
    }

    return { modifiedCount, failedIds }
  },

  /**
   * Soft delete — marks application as rejected and inactive.
   * Hard deletes are intentionally not exposed via the API.
   */
  async softDelete(id: string): Promise<void> {
    const application = await studentApplicationModel.findById(id).select("status")
    if (!application) throw HttpError.notFound(`Application with id '${id}' not found.`)

    if (application.status === "approved") {
      throw HttpError.forbidden(
        "Cannot delete an approved application. Revoke approval first."
      )
    }

    await studentApplicationModel.findByIdAndUpdate(id, {
      $set: { status: "rejected", isActive: false },
    })
  },

  /**
   * Dashboard statistics.
   */
  async getStats() {
    const [statusBreakdown, genderBreakdown, accessStats, monthlyTrend] =
      await Promise.all([
        studentApplicationModel.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),

        studentApplicationModel.aggregate([
          { $match: { gender: { $exists: true } } },
          { $group: { _id: "$gender", count: { $sum: 1 } } },
        ]),

        studentApplicationModel.aggregate([
          {
            $group: {
              _id:          null,
              totalActive:  { $sum: { $cond: ["$isActive",    1, 0] } },
              messEnabled:  { $sum: { $cond: ["$messEnabled", 1, 0] } },
              withRoom:     { $sum: { $cond: [{ $ifNull: ["$room_id", false] }, 1, 0] } },
              total:        { $sum: 1 },
            },
          },
        ]),

        // Applications per month (last 6 months)
        studentApplicationModel.aggregate([
          {
            $match: {
              application_submit_date: {
                $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
          {
            $group: {
              _id: {
                year:  { $year:  "$application_submit_date" },
                month: { $month: "$application_submit_date" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
      ])

    return {
      byStatus: Object.fromEntries(statusBreakdown.map(({ _id, count }) => [_id, count])),
      byGender: Object.fromEntries(genderBreakdown.map(({ _id, count }) => [_id, count])),
      access:   accessStats[0] ?? { totalActive: 0, messEnabled: 0, withRoom: 0, total: 0 },
      monthlyTrend,
    }
  },
}