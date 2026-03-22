import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { HttpError } from "../utils/errors.js"

export type UserRole = "ADMIN" | "STUDENT" | "SUPERADMIN"

export interface JwtPayload {
  sub:            string    // user _id
  role:           UserRole
  email:          string
  applicationId?: string | null  // student_application _id — present for STUDENT role
  iat:            number
  exp:            number
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith("Bearer ")) return auth.slice(7)
  return null
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractBearerToken(req)
  if (!token) return next(HttpError.unauthorized("Authentication required. Provide a Bearer token."))

  const secret = process.env.JWT_SECRET
  if (!secret) return next(HttpError.internal("JWT_SECRET is not configured."))

  try {
    req.user = jwt.verify(token, secret) as JwtPayload
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError)
      return next(HttpError.unauthorized("Token has expired. Please log in again."))
    if (err instanceof jwt.JsonWebTokenError)
      return next(HttpError.unauthorized("Invalid token. Please log in again."))
    next(err)
  }
}

export const requireRole = (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user)              return next(HttpError.unauthorized("Not authenticated."))
    if (!roles.includes(req.user.role))
      return next(HttpError.forbidden(`Access denied. Required: ${roles.join(" or ")}.`))
    next()
  }

/**
 * Guard that ensures a STUDENT has a linked applicationId in their token.
 * Use after `authenticate` + `requireRole("STUDENT")`.
 */
export const requireApplicationId = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user?.applicationId) {
    return next(HttpError.forbidden(
      "Your account is not linked to a hostel application yet. Contact the admin."
    ))
  }
  next()
}

export const isAdmin        = requireRole("ADMIN", "SUPERADMIN")
export const isSuperAdmin   = requireRole("SUPERADMIN")
export const isStudent      = requireRole("STUDENT")
export const isStudentWithApp = [requireRole("STUDENT"), requireApplicationId] as const