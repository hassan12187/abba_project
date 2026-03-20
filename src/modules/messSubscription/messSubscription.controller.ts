import type { Request, Response, NextFunction } from "express";
import { MessSubscriptionService } from "./messSubscription.services.js";
import type { SubscriptionFilters } from "./types.js";

// ─── Utility: wraps async handlers to forward errors to Express ───────────────
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /subscriptions
 * Create a new mess subscription.
 */
export const createSubscription = asyncHandler(async (req, res) => {
  const subscription = await MessSubscriptionService.create(req.body);
  res.status(201).json({
    success: true,
    message: "Subscription created successfully.",
    data: subscription,
  });
});

/**
 * GET /subscriptions
 * List all subscriptions with optional filters and pagination.
 */
export const getAllSubscriptions = asyncHandler(async (req, res) => {
  const filters: SubscriptionFilters = {
    status: req.query.status as SubscriptionFilters["status"],
    planType: req.query.planType as SubscriptionFilters["planType"],
    expiringBefore: req.query.expiringBefore
      ? new Date(req.query.expiringBefore as string)
      : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 10,
  };

  const result = await MessSubscriptionService.getAll(filters);
  res.status(200).json({ success: true, ...result });
});

/**
 * GET /subscriptions/stats
 * Admin dashboard statistics.
 */
export const getSubscriptionStats = asyncHandler(async (_req, res) => {
  const stats = await MessSubscriptionService.getStats();
  res.status(200).json({ success: true, data: stats });
});

/**
 * GET /subscriptions/expiring-soon?withinDays=7
 * Subscriptions expiring within N days (for notifications / cron jobs).
 */
export const getExpiringSoon = asyncHandler(async (req, res) => {
  const withinDays = req.query.withinDays ? Number(req.query.withinDays) : 7;

  if (isNaN(withinDays) || withinDays < 1) {
    res.status(422).json({
      success: false,
      message: "withinDays must be a positive integer.",
    });
    return;
  }

  const subscriptions = await MessSubscriptionService.getExpiringSoon(withinDays);
  res.status(200).json({ success: true, data: subscriptions });
});

/**
 * GET /subscriptions/:id
 * Get a single subscription by its ID.
 */
export const getSubscriptionById = asyncHandler(async (req, res) => {
  const subscription = await MessSubscriptionService.getById(req.params.id);
  res.status(200).json({ success: true, data: subscription });
});

/**
 * GET /subscriptions/student/:studentId
 * Get the subscription for a specific student.
 */
export const getSubscriptionByStudentId = asyncHandler(async (req, res) => {
  const subscription = await MessSubscriptionService.getByStudentId(
    req.params.studentId
  );
  res.status(200).json({ success: true, data: subscription });
});

/**
 * PATCH /subscriptions/:id
 * Update plan type, fee, or validUntil.
 */
export const updateSubscription = asyncHandler(async (req, res) => {
  const subscription = await MessSubscriptionService.update(
    req.params.id,
    req.body
  );
  res.status(200).json({
    success: true,
    message: "Subscription updated successfully.",
    data: subscription,
  });
});

/**
 * PATCH /subscriptions/:id/status
 * Transition subscription status with guard rails.
 */
export const updateSubscriptionStatus = asyncHandler(async (req, res) => {
  const subscription = await MessSubscriptionService.transitionStatus(
    req.params.id,
    req.body.status
  );
  res.status(200).json({
    success: true,
    message: `Subscription status updated to '${req.body.status}'.`,
    data: subscription,
  });
});

/**
 * POST /subscriptions/suspend-expired
 * Bulk suspend expired active subscriptions (for cron jobs).
 */
export const suspendExpiredSubscriptions = asyncHandler(async (_req, res) => {
  const result = await MessSubscriptionService.suspendExpired();
  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} subscription(s) suspended.`,
    data: result,
  });
});

/**
 * DELETE /subscriptions/:id
 * Delete a subscription (only if Cancelled).
 */
export const deleteSubscription = asyncHandler(async (req, res) => {
  await MessSubscriptionService.delete(req.params.id);
  res.status(200).json({
    success: true,
    message: "Subscription deleted successfully.",
  });
});