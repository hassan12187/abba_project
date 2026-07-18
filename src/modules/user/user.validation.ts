import { z } from "zod"
import { USER_ROLES, USER_STATUSES } from "./userModel.js"

const objectId    = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId")
const roleEnum    = z.enum(USER_ROLES)
const statusEnum  = z.enum(USER_STATUSES)

// ─── Register ─────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  body: z.object({
    username: z
      .string({ error: "Username is required." })
      .min(3,   "Username must be at least 3 characters.")
      .max(30,  "Username must be at most 30 characters.")
      .trim(),

    email: z
      .string({ error: "Email is required." })
      .email("Please enter a valid email address.")
      .toLowerCase()
      .trim(),

    password: z
      .string({ error: "Password is required." })
      .min(8, "Password must be at least 8 characters."),

    phone: z
      .string()
      .regex(/^\+?[0-9]{7,15}$/, "Phone must be 7–15 digits, optionally starting with +.")
      .optional(),

    role: roleEnum.optional(),
  }),
})

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  body: z.object({
    email:    z.string().email("Invalid email.").toLowerCase().trim(),
    password: z.string().min(1, "Password is required."),
  }),
})

// ─── Update profile (username + phone only — email never changes here) ────────
export const updateProfileSchema = z.object({
  body: z
    .object({
      username: z.string().min(3).max(30).trim().optional(),
      phone:    z.string().regex(/^\+?[0-9]{7,15}$/).nullable().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Provide at least one field to update.",
    }),
})

// ─── Change password ──────────────────────────────────────────────────────────
export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required."),
      newPassword:     z.string().min(8, "New password must be at least 8 characters."),
      confirmPassword: z.string().min(1, "Confirm password is required."),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: "New passwords do not match.",
      path:    ["confirmPassword"],
    })
    .refine((d) => d.currentPassword !== d.newPassword, {
      message: "New password must be different from your current password.",
      path:    ["newPassword"],
    }),
})

// ─── Forgot password (request reset code) ────────────────────────────────────
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email.").toLowerCase().trim(),
  }),
})

// ─── Reset password (with code) ───────────────────────────────────────────────
export const resetPasswordSchema = z.object({
  body: z
    .object({
      email:           z.string().email().toLowerCase().trim(),
      code:            z.string().min(6).max(6, "Reset code must be 6 digits."),
      newPassword:     z.string().min(8, "Password must be at least 8 characters."),
      confirmPassword: z.string().min(1),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: "Passwords do not match.",
      path:    ["confirmPassword"],
    }),
})

// ─── Refresh token ────────────────────────────────────────────────────────────
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required.").optional(),
  }),
})

// ─── Admin: update any user ───────────────────────────────────────────────────
export const adminUpdateUserSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      username: z.string().min(3).max(30).trim().optional(),
      phone:    z.string().regex(/^\+?[0-9]{7,15}$/).nullable().optional(),
      role:     roleEnum.optional(),
      status:   statusEnum.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Provide at least one field to update.",
    }),
})

// ─── ID param ─────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})