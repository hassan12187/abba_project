import { Request, Response, NextFunction } from "express"
import { Router }            from "express"
import { ComplaintService }  from "./complaint.services.js"
import { validate }          from "../../middleware/validate.middleware.js"
import {
  createComplaintSchema,
  updateComplaintSchema,
  updateStatusSchema,
  complaintFiltersSchema,
  idParamSchema,
} from "./complaint.validation.js"
import type { ComplaintFilters } from "./complaint.types.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Controllers ──────────────────────────────────────────────────────────────

/** GET /complaints/stats */
const getStats = asyncHandler(async (_req, res) => {
  const data = await ComplaintService.getStats()
  res.status(200).json({ success: true, data })
})

/** GET /complaints */
const getAll = asyncHandler(async (req, res) => {
  const filters: ComplaintFilters = {
    status:    req.query.status    as any,
    priority:  req.query.priority  as any,
    category:  req.query.category  as any,
    search:    req.query.search    as string,
    from:      req.query.from      as string,
    to:        req.query.to        as string,
    page:      Number(req.query.page)  || 1,
    limit:     Number(req.query.limit) || 15,
    sortBy:   (req.query.sortBy    as any) || "createdAt",
    sortOrder:(req.query.sortOrder as any) || "desc",
  }
  const result = await ComplaintService.getAll(filters)
  res.status(200).json(result)
})

/** GET /complaints/:id */
const getById = asyncHandler(async (req, res) => {
  const data = await ComplaintService.getById(req.params.id)
  res.status(200).json({ success: true, data })
})

/** POST /complaints */
const createComplaint = asyncHandler(async (req, res) => {
  const data = await ComplaintService.create(req.body)
  res.status(201).json({
    success: true,
    message: "Complaint submitted successfully.",
    data,
  })
})

/** PATCH /complaints/:id */
const updateComplaint = asyncHandler(async (req, res) => {
  const data = await ComplaintService.update(req.params.id, req.body)
  res.status(200).json({ success: true, message: "Complaint updated.", data })
})

/**
 * PATCH /complaints/:id/status
 *
 * Injects current_status into req.body BEFORE Zod validation runs so the
 * transition guard refine() in the schema can check it.
 */
const updateStatus = asyncHandler(async (req, res, next) => {
  // Fetch just the status field to validate the transition
  const { default: ComplaintModel } = await import("./complaint.model.js")
  const existing = await ComplaintModel.findById(req.params.id, { status: 1 }).lean()

  if (!existing) {
    res.status(404).json({ success: false, message: `Complaint ${req.params.id} not found.` })
    return
  }

  // Inject into body so the Zod refine() can access it
  req.body.current_status = existing.status

  // Re-run validation now that current_status is set
  validate(updateStatusSchema)(req, res, async () => {
    const data = await ComplaintService.updateStatus(req.params.id, req.body)
    res.status(200).json({ success: true, message: `Status updated to "${req.body.status}".`, data })
  })
})

/** DELETE /complaints/:id */
const deleteComplaint = asyncHandler(async (req, res) => {
  await ComplaintService.delete(req.params.id)
  res.status(200).json({ success: true, message: "Complaint deleted." })
})

// ─── Router ───────────────────────────────────────────────────────────────────
// Mount as:  app.use("/api/admin/complaints", complaintRouter)

export const complaintRouter = Router()

complaintRouter.get   ("/stats",       getStats)
complaintRouter.get   ("/",            validate(complaintFiltersSchema), getAll)
complaintRouter.get   ("/:id",         validate(idParamSchema),          getById)
complaintRouter.post  ("/",            validate(createComplaintSchema),  createComplaint)
complaintRouter.patch ("/:id",         validate(updateComplaintSchema),  updateComplaint)
complaintRouter.patch ("/:id/status",  updateStatus)                     // validation is inline
complaintRouter.delete("/:id",         validate(idParamSchema),          deleteComplaint)