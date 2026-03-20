import { Request, Response, NextFunction } from "express"
import { StudentApplicationService } from "./studentapplication.services.js"
import { ApplicationFilters } from "./types.js"

// ─── Async wrapper ────────────────────────────────────────────────────────────
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /applications
 * Submit a new student application.
 */
export const createApplication = asyncHandler(async (req, res) => {
  // If an upload middleware ran, attach the file paths from req.files
  const body = { ...req.body }

  if (req.files) {
    const files = req.files as Record<string, Express.Multer.File[]>
    if (files.student_image?.[0]) body.student_image = files.student_image[0].path
    if (files.cnic_image?.length)  body.cnic_image   = files.cnic_image.map((f) => f.path)
  }

  const application = await StudentApplicationService.create(body)
  res.status(201).json({
    success: true,
    message: "Application submitted successfully.",
    data: application,
  })
})

/**
 * GET /applications/stats
 * Admin dashboard stats — must be declared before /:id.
 */
export const getApplicationStats = asyncHandler(async (_req, res) => {
  const stats = await StudentApplicationService.getStats()
  res.status(200).json({ success: true, data: stats })
})

/**
 * GET /applications
 * Paginated list with optional filters.
 */
export const getAllApplications = asyncHandler(async (req, res) => {
  const filters: ApplicationFilters = {
    status:        req.query.status        as ApplicationFilters["status"],
    gender:        req.query.gender        as ApplicationFilters["gender"],
    city:          req.query.city          as string,
    province:      req.query.province      as string,
    academic_year: req.query.academic_year as string,
    messEnabled:   req.query.messEnabled   as unknown as boolean,
    isActive:      req.query.isActive      as unknown as boolean,
    search:        req.query.search        as string,
    page:          Number(req.query.page)  || 1,
    limit:         Number(req.query.limit) || 10,
    sortBy:        req.query.sortBy        as ApplicationFilters["sortBy"],
    sortOrder:     req.query.sortOrder     as ApplicationFilters["sortOrder"],
  }

  const result = await StudentApplicationService.getAll(filters)
  res.status(200).json({ success: true, ...result })
})

/**
 * GET /applications/:id
 * Single application by ID.
 */
export const getApplicationById = asyncHandler(async (req, res) => {
  const application = await StudentApplicationService.getById(req.params.id)
  res.status(200).json({ success: true, data: application })
})

/**
 * GET /applications/by-email/:email
 * Lookup by student email (self-service / portal).
 */
export const getApplicationByEmail = asyncHandler(async (req, res) => {
  const application = await StudentApplicationService.getByEmail(req.params.email)
  res.status(200).json({ success: true, data: application })
})

/**
 * PATCH /applications/:id
 * Admin update of general fields.
 */
export const updateApplication = asyncHandler(async (req, res) => {
  const body = { ...req.body }

  // Handle updated images if re-uploaded
  if (req.files) {
    const files = req.files as Record<string, Express.Multer.File[]>
    if (files.student_image?.[0]) body.student_image = files.student_image[0].path
    if (files.cnic_image?.length)  body.cnic_image   = files.cnic_image.map((f) => f.path)
  }

  const application = await StudentApplicationService.update(req.params.id, body)
  res.status(200).json({
    success: true,
    message: "Application updated successfully.",
    data: application,
  })
})

/**
 * PATCH /applications/:id/status
 * Controlled status transition.
 */
export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const application = await StudentApplicationService.updateStatus(
    req.params.id,
    req.body
  )
  res.status(200).json({
    success: true,
    message: `Application status changed to '${req.body.status}'.`,
    data: application,
  })
})

/**
 * PATCH /applications/:id/access
 * Toggle messEnabled and/or isActive.
 */
export const toggleAccess = asyncHandler(async (req, res) => {
  const application = await StudentApplicationService.toggleAccess(
    req.params.id,
    req.body
  )
  res.status(200).json({
    success: true,
    message: "Access settings updated.",
    data: application,
  })
})

/**
 * PATCH /applications/:id/room
 * Assign or unassign a room.
 */
export const assignRoom = asyncHandler(async (req, res) => {
  const application = await StudentApplicationService.assignRoom(
    req.params.id,
    req.body
  )
  res.status(200).json({
    success: true,
    message: req.body.room_id ? "Room assigned successfully." : "Room unassigned.",
    data: application,
  })
})

/**
 * POST /applications/bulk-status
 * Admin: update status of multiple applications in one request.
 */
export const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { ids, status, reason } = req.body
  const result = await StudentApplicationService.bulkUpdateStatus(ids, status, reason)
  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} application(s) updated.`,
    data: result,
  })
})

/**
 * DELETE /applications/:id
 * Soft delete — marks as rejected + inactive.
 */
export const deleteApplication = asyncHandler(async (req, res) => {
  await StudentApplicationService.softDelete(req.params.id)
  res.status(200).json({
    success: true,
    message: "Application removed successfully.",
  })
})