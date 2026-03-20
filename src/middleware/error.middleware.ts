import { Request, Response, NextFunction } from "express"
import multer from "multer"
import { HttpError } from "../utils/errors.js"

export function globalErrorHandler(
  err:  Error,
  _req: Request,
  res:  Response,
  _next: NextFunction    // ← 4th param required — Express identifies error handlers by arity
): void {

  // ── 1. Known operational error (HttpError thrown by services) ────────────────
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    })
    return
  }

  // ── 2. Multer file upload errors ──────────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE:      "File too large. Maximum allowed size is 5 MB.",
      LIMIT_FILE_COUNT:     "Too many files uploaded.",
      LIMIT_UNEXPECTED_FILE:"Unexpected file field name.",
    }
    res.status(413).json({
      success: false,
      message: messages[err.code] ?? `Upload error: ${err.message}`,
    })
    return
  }

  // ── 3. Mongoose duplicate key (unique index violation) ────────────────────────
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0] ?? "field"
    const value = (err as any).keyValue?.[field]
    res.status(409).json({
      success: false,
      message: `A record with ${field} '${value}' already exists.`,
    })
    return
  }

  // ── 4. Mongoose validation error ──────────────────────────────────────────────
  if (err.name === "ValidationError") {
    const errors = Object.values((err as any).errors).map((e: any) => ({
      field:   e.path,
      message: e.message,
    }))
    res.status(422).json({
      success: false,
      message: "Validation failed.",
      errors,
    })
    return
  }

  // ── 5. Mongoose CastError (invalid ObjectId) ──────────────────────────────────
  if (err.name === "CastError") {
    res.status(400).json({
      success: false,
      message: `Invalid value '${(err as any).value}' for field '${(err as any).path}'.`,
    })
    return
  }

  // ── 6. JWT errors (if not caught inside auth middleware) ──────────────────────
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({ success: false, message: "Invalid token." })
    return
  }
  if (err.name === "TokenExpiredError") {
    res.status(401).json({ success: false, message: "Token has expired. Please log in again." })
    return
  }

  // ── 7. Zod errors that escaped validation middleware ──────────────────────────
  if (err.name === "ZodError") {
    res.status(422).json({
      success: false,
      message: "Validation failed.",
      errors:  (err as any).errors?.map((e: any) => ({
        field:   e.path.join("."),
        message: e.message,
      })),
    })
    return
  }

  // ── 8. Unknown / programming error — log it, never leak internals ─────────────
  console.error("─────────────────────────────────────")
  console.error("[Unhandled Error]", err.name, err.message)
  console.error(err.stack)
  console.error("─────────────────────────────────────")

  res.status(500).json({
    success: false,
    message: "An unexpected error occurred. Please try again later.",
  })
}