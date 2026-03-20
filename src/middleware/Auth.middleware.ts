import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { HttpError } from "../utils/errors.js"

// ─── Token payload shape ──────────────────────────────────────────────────────
export type UserRole = "ADMIN" | "student" | "staff"

export interface JwtPayload {
  sub:        string        // MongoDB _id (student or admin)
  role:       UserRole
  email?:     string
  student_id?: string      // present when role === "student"
  iat:        number
  exp:        number
}

// ─── Augment Express Request ──────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith("Bearer ")) return auth.slice(7)
  return null
}

// ─── Middleware: verify JWT ───────────────────────────────────────────────────
/**
 * Verifies the Bearer token and attaches the decoded payload to `req.user`.
 * Throws 401 if the token is missing, malformed, or expired.
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractBearerToken(req)

  if (!token) {
    return next(HttpError.unauthorized("Authentication required. Provide a Bearer token."))
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return next(HttpError.internal("JWT_SECRET is not configured on the server."))
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload
    req.user = payload
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(HttpError.unauthorized("Token has expired. Please log in again."))
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(HttpError.unauthorized("Invalid token. Please log in again."))
    }
    next(err)
  }
}

// ─── Middleware: require specific roles ───────────────────────────────────────
/**
 * Factory that creates a middleware enforcing one or more allowed roles.
 * Must be used AFTER `authenticate`.
 *
 * Usage:
 *   router.get("/admin-only", authenticate, requireRole("admin"), handler)
 *   router.get("/staff-or-admin", authenticate, requireRole("admin", "staff"), handler)
 */
export const requireRole = (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(HttpError.unauthorized("Not authenticated."))
    }
    if (!roles.includes(req.user.role)) {
      return next(
        HttpError.forbidden(
          `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.user.role}.`
        )
      )
    }
    next()
  }

// ─── Convenience guards ───────────────────────────────────────────────────────
export const isAdmin   = requireRole("ADMIN")
export const isStudent = requireRole("student")
export const isStaff   = requireRole("ADMIN", "staff")