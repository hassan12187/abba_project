import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

// ─── Reusable field validators ────────────────────────────────────────────────

const planTypeEnum = z.enum(["Monthly", "Semester", "Pay_Per_Meal"]);
const statusEnum = z.enum(["Active", "Cancelled", "Suspended"]);

const monthlyFeeSchema = z
  .number({ invalid_type_error: "monthlyFee must be a number" })
  .positive("monthlyFee must be a positive number")
  .multipleOf(0.01, "monthlyFee must have at most 2 decimal places");

const validUntilSchema = z
  .string()
  .datetime({ message: "validUntil must be a valid ISO 8601 date string" })
  .transform((val) => new Date(val))
  .refine((date) => date > new Date(), {
    message: "validUntil must be a future date",
  })
  .optional();

// ─── Create ───────────────────────────────────────────────────────────────────

export const createSubscriptionSchema = z.object({
  body: z.object({
    student: z
      .string({ required_error: "student is required" })
      .regex(objectIdRegex, "student must be a valid MongoDB ObjectId"),
    planType: planTypeEnum.optional(),
    monthlyFee: monthlyFeeSchema,
    validUntil: validUntilSchema,
  }),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "id must be a valid MongoDB ObjectId"),
  }),
  body: z
    .object({
      planType: planTypeEnum.optional(),
      status: statusEnum.optional(),
      monthlyFee: monthlyFeeSchema.optional(),
      validUntil: validUntilSchema,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const subscriptionIdSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "id must be a valid MongoDB ObjectId"),
  }),
});

export const studentIdSchema = z.object({
  params: z.object({
    studentId: z
      .string()
      .regex(objectIdRegex, "studentId must be a valid MongoDB ObjectId"),
  }),
});

// ─── Query filters ────────────────────────────────────────────────────────────

export const subscriptionFiltersSchema = z.object({
  query: z.object({
    status: statusEnum.optional(),
    planType: planTypeEnum.optional(),
    expiringBefore: z
      .string()
      .datetime()
      .transform((val) => new Date(val))
      .optional(),
    page: z
      .string()
      .transform(Number)
      .pipe(z.number().int().min(1))
      .optional()
      .default("1"),
    limit: z
      .string()
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .optional()
      .default("10"),
  }),
});

// ─── Status transition ────────────────────────────────────────────────────────

export const statusTransitionSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "id must be a valid MongoDB ObjectId"),
  }),
  body: z.object({
    status: statusEnum,
    reason: z.string().min(3).max(255).optional(),
  }),
});