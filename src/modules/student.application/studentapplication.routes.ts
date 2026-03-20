import { Router } from "express"
import {
  createApplication,
  getAllApplications,
  getApplicationById,
  getApplicationByEmail,
  getApplicationStats,
  updateApplication,
  updateApplicationStatus,
  toggleAccess,
  assignRoom,
  bulkUpdateStatus,
  deleteApplication,
} from "./studentapplication.controller.js"
import { validate }                   from "../../middleware/validate.middleware.js"
import { uploadApplicationImages }    from "./upload.middleware.js"
import {
  createApplicationSchema,
  updateApplicationSchema,
  updateStatusSchema,
  toggleAccessSchema,
  assignRoomSchema,
  idParamSchema,
  applicationFiltersSchema,
  bulkStatusSchema,
} from "./validation.js"

const router = Router()

// ─── Static routes (must come before /:id) ───────────────────────────────────

// GET  /applications/stats
router.get("/stats", getApplicationStats)

// POST /applications/bulk-status
router.post("/bulk-status", validate(bulkStatusSchema), bulkUpdateStatus)

// GET  /applications/by-email/:email
router.get("/by-email/:email", getApplicationByEmail)

// ─── Collection ───────────────────────────────────────────────────────────────

// GET  /applications?status=pending&search=ali&page=1&limit=10
router.get("/", validate(applicationFiltersSchema), getAllApplications)

// POST /applications  (multipart/form-data for image uploads)
router.post(
  "/",
  uploadApplicationImages,
  validate(createApplicationSchema),
  createApplication
)

// ─── Single resource ──────────────────────────────────────────────────────────

// GET    /applications/:id
router.get("/:id", validate(idParamSchema), getApplicationById)

// PATCH  /applications/:id  — general field update (also handles re-upload)
router.patch(
  "/:id",
  uploadApplicationImages,
  validate(updateApplicationSchema),
  updateApplication
)

// PATCH  /applications/:id/status  — controlled status transition
router.patch(
  "/:id/status",
  validate(updateStatusSchema),
  updateApplicationStatus
)

// PATCH  /applications/:id/access  — toggle messEnabled / isActive
router.patch(
  "/:id/access",
  validate(toggleAccessSchema),
  toggleAccess
)

// PATCH  /applications/:id/room  — assign or unassign room
router.patch(
  "/:id/room",
  validate(assignRoomSchema),
  assignRoom
)

// DELETE /applications/:id  — soft delete
router.delete("/:id", validate(idParamSchema), deleteApplication)

export default router