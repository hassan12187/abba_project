import { Server, Socket } from "socket.io"
import { Server as HttpServer } from "http"
import jwt from "jsonwebtoken"

let io: Server | null = null

export const ROOMS = {
  admins:  "admins",
  student: (userId: string) => `student:${userId}`,
}

// ── Accepts the allowedOrigins array from index.ts so CORS is configured ──────
// in one place — not duplicated between Express and Socket.io.
export function initSocket(httpServer: HttpServer, allowedOrigins?: string[]): Server {
  io = new Server(httpServer, {
    cors: {
      origin:      allowedOrigins?.length ? allowedOrigins : "*",
      credentials: true,
    },
    pingTimeout:  20000,
    pingInterval: 25000,
  })

  // ── JWT auth middleware ───────────────────────────────────────────────────
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ??
      socket.handshake.headers?.authorization?.replace("Bearer ", "")

    if (!token) return next(new Error("Authentication required"))

    const secret = process.env.JWT_SECRET
    if (!secret) return next(new Error("JWT_SECRET not configured"))

    try {
      const payload = jwt.verify(token, secret) as {
        sub: string; role: string; applicationId?: string
      }
      ;(socket as any).user = payload
      next()
    } catch {
      next(new Error("Invalid token"))
    }
  })

  // ── Room assignment on connect ────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user

    if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
      socket.join(ROOMS.admins)
    }
    if (user.role === "STUDENT") {
      socket.join(ROOMS.student(user.sub))
    }
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialised. Call initSocket() first.")
  return io
}