import jwt           from "jsonwebtoken"
import { hash }      from "bcrypt"
import User          from "./userModel.js"
import studentApplicationModel from "../student.application/studentApplicationModel.js"
import redis         from "../../services/Redis.js"
import { HttpError } from "../../utils/errors.js"
import type { IUser, UserRole, UserStatus } from "./userModel.js"
import { changePasswordVerification } from "../../services/emailJobs.js"

const ACCESS_SECRET  = process.env.JWT_SECRET         ?? (() => { throw new Error("JWT_SECRET not set") })()
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? (() => { throw new Error("JWT_REFRESH_SECRET not set") })()
const ACCESS_TTL     = "15m"
const REFRESH_TTL    = "7d"
const RESET_CODE_TTL = 10 * 60   // 10 min (seconds)

const userCacheKey = (id: string) => `user:profile:${id}`
const CACHE_TTL    = 5 * 60

function signAccessToken(p: { sub: string; role: UserRole; email: string; applicationId?: string | null }) {
  return jwt.sign(p, ACCESS_SECRET, { expiresIn: ACCESS_TTL })
}
function signRefreshToken(sub: string) {
  return jwt.sign({ sub }, REFRESH_SECRET, { expiresIn: REFRESH_TTL })
}

function sanitise(user: any) {
  const obj = user.toObject ? user.toObject() : { ...user }
  delete obj.password; delete obj.refreshToken
  delete obj.passwordResetCode; delete obj.passwordResetExpires
  delete obj.failedLoginAttempts; delete obj.lockedUntil
  delete obj.__v
  return obj
}

export const UserService = {

  // ── Auth ──────────────────────────────────────────────────────────────────

  async register(dto: {
    username: string; email: string; password: string
    phone?: string;   role?: UserRole
  }) {
    const exists = await User.findOne({ email: dto.email }).lean()
    if (exists) throw HttpError.conflict("An account with this email already exists.")

    // ── Link to student application if registering as STUDENT ────────────────
    // Match by email so the admin doesn't need to provide the applicationId.
    // If no application is found, the account still creates successfully —
    // the student might apply after registering.
    let applicationId: string | null = null
    if (!dto.role || dto.role === "STUDENT") {
      const application = await studentApplicationModel
        .findOne({ student_email: dto.email.toLowerCase() })
        .select("_id")
        .lean()
      if (application) {
        applicationId = application._id.toString()
        // Back-link the application to the user (set after user is created below)
      }
    }

    const user:IUser = await User.create({
      username:      dto.username,
      email:         dto.email,
      password:      dto.password,
      phone:         dto.phone ?? null,
      role:          dto.role  ?? "STUDENT",
      isFirstLogin:  true,
      applicationId: applicationId,
    })

    // Write userId back to the application so the admin panel can resolve it too
    if (applicationId) {
      await studentApplicationModel.findByIdAndUpdate(applicationId, {
        $set: { userId: user._id },
      })
    }
    const accessToken  = signAccessToken({
      sub:           user._id.toString(),
      role:          user.role,
      email:         user.email,
      applicationId: applicationId,
    })
    const refreshToken = signRefreshToken(user._id.toString())
    const hashedRefresh = await hash(refreshToken, 10)
    await User.findByIdAndUpdate(user._id, { refreshToken: hashedRefresh })

    return { user: sanitise(user), accessToken, refreshToken }
  },

  async login(dto: { email: string; password: string }) {
    const user = await User.findOne({ email: dto.email })
      .select("+password +refreshToken +failedLoginAttempts +lockedUntil")

    if (!user) throw HttpError.unauthorized("Invalid email or password.")
      if (user.isLocked()) {
      const lockedUntil=user.lockedUntil;
      if(lockedUntil){
        const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
        throw HttpError.unauthorized(`Account locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`)
      }
    }
    if (user.status === "DISCONTINUED") {
      throw HttpError.forbidden("This account has been discontinued. Contact support.")
    }

    const match = await user.comparePassword(dto.password)
    if (!match) {
      await user.registerFailedLogin()
      throw HttpError.unauthorized("Invalid email or password.")
    }

    await user.clearFailedLogins()

    const accessToken  = signAccessToken({
      sub:           user._id.toString(),
      role:          user.role,
      email:         user.email,
      applicationId: user.applicationId?.toString() ?? null,
    })
    const refreshToken = signRefreshToken(user._id.toString())
    const hashedRefresh = await hash(refreshToken, 10)
    await User.findByIdAndUpdate(user._id, {
      refreshToken: hashedRefresh,
      lastLoginAt:  new Date(),
      isFirstLogin: false,
    })

    await redis.del(userCacheKey(user._id.toString())).catch(() => {})
    return { user: sanitise(user), accessToken, refreshToken }
  },

  async refreshTokens(incoming: string) {
    let payload: jwt.JwtPayload
    try { payload = jwt.verify(incoming, REFRESH_SECRET) as jwt.JwtPayload }
    catch { throw HttpError.unauthorized("Invalid or expired refresh token.") }

    const user = await User.findById(payload.sub).select("+refreshToken")
    if (!user || !user.refreshToken) throw HttpError.unauthorized("Session not found. Please log in again.")

    const accessToken    = signAccessToken({
      sub:           user._id.toString(),
      role:          user.role,
      email:         user.email,
      applicationId: user.applicationId?.toString() ?? null,
    })
    const newRefresh     = signRefreshToken(user._id.toString())
    const hashedRefresh  = await hash(newRefresh, 10)
    await User.findByIdAndUpdate(user._id, { refreshToken: hashedRefresh })
    return { accessToken, refreshToken: newRefresh }
  },

  async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { refreshToken: null })
    await redis.del(userCacheKey(userId)).catch(() => {})
  },

  // ── Password ──────────────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await User.findOne({ email })
    if (!user) return   // silent — prevent email enumeration
    const code    = Math.floor(100000 + Math.random() * 900000).toString()
    const hashed  = await hash(code, 10)
    const expires = new Date(Date.now() + RESET_CODE_TTL * 1000)
    await User.findByIdAndUpdate(user._id, {
      passwordResetCode:    hashed,
      passwordResetExpires: expires,
    })
    await redis.set(`reset:code:${user._id}`, code, "EX", RESET_CODE_TTL)
    // TODO: EmailService.sendResetCode(user.email, code)
    await changePasswordVerification(user.email,code);
    return { userId: user._id.toString() }
  },

  async resetPassword(dto: { email: string; code: string; newPassword: string }) {
    const user = await User.findOne({ email: dto.email })
      .select("+passwordResetCode +passwordResetExpires")
    if (!user?.passwordResetCode || !user.passwordResetExpires) {
      throw HttpError.badRequest("No password reset was requested for this email.")
    }
    if (user.passwordResetExpires < new Date()) {
      throw HttpError.badRequest("Reset code has expired. Please request a new one.")
    }
    const { compare } = await import("bcrypt")
    const valid = await compare(dto.code, user.passwordResetCode)
    if (!valid) throw HttpError.badRequest("Invalid reset code.")
    user.password             = dto.newPassword
    user.passwordResetCode    = undefined as any
    user.passwordResetExpires = undefined as any
    user.refreshToken         = null as any
    await user.save()
    await redis.del(`reset:code:${user._id}`).catch(() => {})
    await redis.del(userCacheKey(user._id.toString())).catch(() => {})
  },

  // ── Profile ───────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const cacheKey = userCacheKey(userId)
    const cached   = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)
    const user = await User.findById(userId).lean()
    if (!user) throw HttpError.notFound("User not found.")
    const safe = sanitise(user)
    await redis.set(cacheKey, JSON.stringify(safe), "EX", CACHE_TTL)
    return safe
  },

  async updateProfile(userId: string, dto: { username?: string; phone?: string | null }) {
    const update: Record<string, any> = {}
    if (dto.username !== undefined) update.username = dto.username
    if (dto.phone    !== undefined) update.phone    = dto.phone
    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true }).lean()
    if (!user) throw HttpError.notFound("User not found.")
    const safe = sanitise(user)
    await redis.set(userCacheKey(userId), JSON.stringify(safe), "EX", CACHE_TTL)
    return safe
  },

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await User.findById(userId).select("+password")
    if (!user) throw HttpError.notFound("User not found.")
    const match = await user.comparePassword(dto.currentPassword)
    if (!match) throw HttpError.badRequest("Current password is incorrect.")
    user.password     = dto.newPassword
    user.refreshToken = null as any
    await user.save()
    await redis.del(userCacheKey(userId)).catch(() => {})
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  async getAllUsers(filters: {
    role?: string; status?: string; search?: string; page?: number; limit?: number
  }) {
    const { role, status, page = 1, limit = 20, search } = filters
    const query: Record<string, any> = {}
    if (role)   query.role   = role
    if (status) query.status = status
    if (search) query.$or    = [
      { username: { $regex: search, $options: "i" } },
      { email:    { $regex: search, $options: "i" } },
    ]
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ])
    return { data: data.map(sanitise), total, page, limit, totalPages: Math.ceil(total / limit) }
  },

  async updateUserByAdmin(
    id: string,
    dto: { username?: string; phone?: string | null; role?: UserRole; status?: UserStatus }
  ) {
    const user = await User.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true }).lean()
    if (!user) throw HttpError.notFound(`User ${id} not found.`)
    await redis.del(userCacheKey(id)).catch(() => {})
    return sanitise(user)
  },

  async deleteUser(id: string) {
    const user = await User.findByIdAndDelete(id)
    if (!user) throw HttpError.notFound(`User ${id} not found.`)
    await redis.del(userCacheKey(id)).catch(() => {})
  },

  // ── Student: link existing account to application ─────────────────────────
  // Called by admin after approving an application for a user who registered before applying.
  async linkApplication(userId: string, applicationId: string) {
    const [user, application] = await Promise.all([
      User.findById(userId),
      studentApplicationModel.findById(applicationId).select("_id student_email").lean(),
    ])
    if (!user)        throw HttpError.notFound(`User ${userId} not found.`)
    if (!application) throw HttpError.notFound(`Application ${applicationId} not found.`)

    user.applicationId = applicationId as any
    await user.save()

    await studentApplicationModel.findByIdAndUpdate(applicationId, { $set: { userId } })
    await redis.del(userCacheKey(userId)).catch(() => {})
    return sanitise(user)
  },
}