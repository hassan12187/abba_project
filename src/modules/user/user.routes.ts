import { Request, Response, NextFunction } from "express"
import { Router }      from "express"
import { UserService } from "./user.services.js"
import { validate }    from "../../middleware/validate.middleware.js"
import { authenticate, requireRole } from "../../middleware/Auth.middleware.js"
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  adminUpdateUserSchema,
  idParamSchema,
  verifyCodeSchema,
} from "./user.validation.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Cookie config ────────────────────────────────────────────────────────────
// Refresh token is stored in an httpOnly cookie so JS cannot read it
const REFRESH_COOKIE_NAME = "refreshToken"
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge:   7 * 24 * 60 * 60 * 1000,    // 7 days ms
}

// ─── Auth controllers ─────────────────────────────────────────────────────────

/** POST /auth/register */
const register = asyncHandler(async (req, res) => {
  const result = await UserService.register(req.body)

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS)

  res.status(201).json({
    success:     true,
    message:     "Account created successfully.",
    accessToken: result.accessToken,
    data:        result.user,
  })
})

/** POST /auth/login */
const login = asyncHandler(async (req, res) => {
  const result = await UserService.login(req.body)

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS)

  res.status(200).json({
    success:     true,
    message:     `Welcome back, ${result.user.username}.`,
    accessToken: result.accessToken,
    data:        result.user,
  })
})

/**
 * POST /auth/refresh
 * Reads refresh token from cookie (preferred) or body (fallback for mobile).
 */
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body.refreshToken
  if (!token) {
    res.status(401).json({ success: false, message: "Refresh token required." })
    return
  }
  const result = await UserService.refreshTokens(token)

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS)

  res.status(200).json({
    success:     true,
    accessToken: result.accessToken,
  })
})

/** POST /auth/logout */
const logout = asyncHandler(async (req, res) => {
  const userId = req.user?.sub
  if (userId) await UserService.logout(userId)

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
  })

  res.status(200).json({ success: true, message: "Logged out successfully." })
})

/** POST /auth/forgot-password */
const forgotPassword = asyncHandler(async (req, res) => {
  await UserService.forgotPassword(req.body.email)
  // Always 200 to prevent email enumeration
  res.status(200).json({
    success: true,
    message: "If an account with that email exists, a reset code has been sent.",
  })
})

// POST verify code
const verifyCode=asyncHandler(async (req,res)=>{
  const result = await UserService.verifyCodeAdd(req.body.code,req.body.email);
  console.log("inside")
  res.status(200).json({
    success:result,
    message:`${result ? "" : "Invalid or Expired Code."}`
  });
})

/** POST /auth/reset-password */
const resetPassword = asyncHandler(async (req, res) => {
  await UserService.resetPassword(req.body)
  res.status(200).json({
    success: true,
    message: "Password reset successfully. Please log in with your new password.",
  })
})

// ─── Profile controllers ──────────────────────────────────────────────────────

/** GET /auth/me */
const getMe = asyncHandler(async (req, res) => {
  const data = await UserService.getMe(req.user!.sub)
  res.status(200).json({ success: true, data })
})

/** PATCH /auth/me */
const updateProfile = asyncHandler(async (req, res) => {
  const data = await UserService.updateProfile(req.user!.sub, req.body)
  res.status(200).json({ success: true, message: "Profile updated.", data })
})

/** PATCH /auth/me/password */
const changePassword = asyncHandler(async (req, res) => {
  await UserService.changePassword(req.user!.sub, req.body)

  // Invalidate refresh cookie — user must log in again after password change
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
  })

  res.status(200).json({
    success: true,
    message: "Password changed successfully. Please log in again.",
  })
})

// ─── Admin controllers ────────────────────────────────────────────────────────

/** GET /auth/users */
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, status, page, limit, search } = req.query as any
  const result = await UserService.getAllUsers({
    role, status, search,
    page:  Number(page)  || 1,
    limit: Number(limit) || 20,
  })
  res.status(200).json({ success: true, ...result })
})

/** GET /auth/users/:id */
const getUserById = asyncHandler(async (req, res) => {
  const data = await UserService.getMe(req.params.id as string)
  res.status(200).json({ success: true, data })
})

/** PATCH /auth/users/:id */
const adminUpdateUser = asyncHandler(async (req, res) => {
  const data = await UserService.updateUserByAdmin(req.params.id as string, req.body)
  res.status(200).json({ success: true, message: "User updated.", data })
})

/** DELETE /auth/users/:id */
const deleteUser = asyncHandler(async (req, res) => {
  await UserService.deleteUser(req.params.id as string)
  res.status(200).json({ success: true, message: "User deleted." })
})

// ─── Router ───────────────────────────────────────────────────────────────────
// Mount as:  app.use("/api/auth", authRouter)

export const authRouter = Router()

// ── Public routes (no auth needed) ───────────────────────────────────────────
authRouter.post("/register",       validate(registerSchema),       register)
authRouter.post("/login",          validate(loginSchema),          login)
authRouter.post("/refresh",        validate(refreshTokenSchema),   refreshToken)
authRouter.post("/forgot-password",validate(forgotPasswordSchema), forgotPassword)
authRouter.post("/reset-password", validate(resetPasswordSchema),  resetPassword)
authRouter.post("/verify-code",validate(verifyCodeSchema),verifyCode)

// ── Authenticated routes (any logged-in user) ─────────────────────────────────
authRouter.post  ("/logout",       authenticate,                   logout)
authRouter.get   ("/me",           authenticate,                   getMe)
authRouter.patch ("/me",           authenticate, validate(updateProfileSchema),  updateProfile)
authRouter.patch ("/me/password",  authenticate, validate(changePasswordSchema), changePassword)

// ── Admin-only routes ─────────────────────────────────────────────────────────
// requireRole checks that role === "ADMIN" | "SUPERADMIN" after authenticate
const isAdmin = requireRole("ADMIN", "SUPERADMIN")

authRouter.get   ("/users",     authenticate, isAdmin, getAllUsers)
authRouter.get   ("/users/:id", authenticate, isAdmin, validate(idParamSchema),         getUserById)
authRouter.patch ("/users/:id", authenticate, isAdmin, validate(adminUpdateUserSchema),  adminUpdateUser)
authRouter.delete("/users/:id", authenticate, isAdmin, validate(idParamSchema),          deleteUser)