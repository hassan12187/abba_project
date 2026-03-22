import { Server, Socket } from "socket.io"
import { Server as HttpServer } from "http"
import jwt from "jsonwebtoken"

// ─── Singleton ────────────────────────────────────────────────────────────────
// io is initialised once in server.ts and exported here so any service
// can call io.emit() without importing express/http again.
let io: Server | null = null

// Room name conventions:
//   "admins"          → all connected admin/superadmin sockets
//   "student:<userId>"→ a specific student's socket
export const ROOMS = {
  admins:  "admins",
  student: (userId: string) => `student:${userId}`,
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.ADMIN_FRONTEND_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    },
    // Ping timeout/interval — keeps connections alive without excess overhead
    pingTimeout:  20000,
    pingInterval: 25000,
  })

  // ── JWT authentication middleware ─────────────────────────────────────────
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ??
      socket.handshake.headers?.authorization?.replace("Bearer ", "")

    if (!token) {
      return next(new Error("Authentication required"))
    }

    const secret = process.env.JWT_SECRET
    if (!secret) return next(new Error("JWT_SECRET not configured"))

    try {
      const payload = jwt.verify(token, secret) as {
        sub: string; role: string; applicationId?: string
      }
      // Attach decoded payload to the socket for use in event handlers
      ;(socket as any).user = payload
      next()
    } catch {
      next(new Error("Invalid token"))
    }
  })

  // ── Connection handler ────────────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user

    // Put admins in the "admins" room, students in their personal room
    if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
      socket.join(ROOMS.admins)
    }

    if (user.role === "STUDENT") {
      socket.join(ROOMS.student(user.sub))
    }

    socket.on("disconnect", () => {
      // Nothing to clean up — socket.io handles room membership automatically
    })
  })

  return io
}

/** Get the initialised Socket.io server — throws if called before initSocket() */
export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialised. Call initSocket() first.")
  return io
}