import { Router } from "express";
import {
  createSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  getSubscriptionByStudentId,
  getSubscriptionStats,
  getExpiringSoon,
  updateSubscription,
  updateSubscriptionStatus,
  suspendExpiredSubscriptions,
  deleteSubscription,
} from "./messSubscription.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  subscriptionIdSchema,
  studentIdSchema,
  subscriptionFiltersSchema,
  statusTransitionSchema,
} from "./messSubscription.validation.js";

const router = Router();

// ─── Read ─────────────────────────────────────────────────────────────────────

// GET /subscriptions/stats              — must be before /:id to avoid shadowing
router.get("/stats", getSubscriptionStats);

// GET /subscriptions/expiring-soon?withinDays=7
router.get("/expiring-soon", getExpiringSoon);

// GET /subscriptions?status=Active&planType=Monthly&page=1&limit=10
router.get("/", validate(subscriptionFiltersSchema), getAllSubscriptions);

// GET /subscriptions/:id
router.get("/:id", validate(subscriptionIdSchema), getSubscriptionById);

// GET /subscriptions/student/:studentId
router.get(
  "/student/:studentId",
  validate(studentIdSchema),
  getSubscriptionByStudentId
);

// ─── Write ────────────────────────────────────────────────────────────────────

// POST /subscriptions
router.post("/", validate(createSubscriptionSchema), createSubscription);

// PATCH /subscriptions/:id              — update plan/fee/validUntil
router.patch("/:id", validate(updateSubscriptionSchema), updateSubscription);

// PATCH /subscriptions/:id/status       — controlled status transition
router.patch(
  "/:id/status",
  validate(statusTransitionSchema),
  updateSubscriptionStatus
);

// POST /subscriptions/suspend-expired   — cron-job endpoint
router.post("/suspend-expired", suspendExpiredSubscriptions);

// DELETE /subscriptions/:id             — only for Cancelled subscriptions
router.delete("/:id", validate(subscriptionIdSchema), deleteSubscription);

export default router;