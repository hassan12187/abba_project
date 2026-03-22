import { Schema, model } from "mongoose"
import { hash, compare }  from "bcrypt"

export const USER_ROLES    = ["ADMIN", "STUDENT", "SUPERADMIN"] as const
export const USER_STATUSES = ["ACTIVE", "DISCONTINUED"]         as const

export type UserRole   = (typeof USER_ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]

const userSchema = new Schema(
  {
    username: {
      type:      String,
      required:  [true, "Username is required."],
      minlength: [3,   "Username must be at least 3 characters."],
      maxlength: [30,  "Username must be at most 30 characters."],
      trim:      true,
    },
    email: {
      type:      String,
      required:  [true, "Email is required."],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address."],
    },
    phone: {
      type:      String,
      trim:      true,
      maxlength: [15, "Phone number must be at most 15 characters."],
      match:     [/^\+?[0-9]{7,15}$/, "Phone must be 7–15 digits, optionally starting with +."],
      default:   null,
    },
    password: {
      type:      String,
      required:  [true, "Password is required."],
      minlength: [8,   "Password must be at least 8 characters."],
      select:    false,
    },

    // ── Link to student_application ──────────────────────────────────────────
    // Populated when a STUDENT account is created/linked to an application.
    // Used by all student portal routes so they never need to pass a student ID.
    applicationId: {
      type:    Schema.Types.ObjectId,
      ref:     "student_application",
      default: null,
      index:   true,
    },

    avatar:       { type: String,  default: null },
    role:         { type: String,  enum: USER_ROLES,    default: "STUDENT" },
    status:       { type: String,  enum: USER_STATUSES, default: "ACTIVE"  },
    isFirstLogin: { type: Boolean, default: true  },
    lastLoginAt:  { type: Date,    default: null  },

    refreshToken:         { type: String, select: false, default: null },
    passwordResetCode:    { type: String, select: false, default: null },
    passwordResetExpires: { type: Date,   select: false, default: null },

    failedLoginAttempts: { type: Number, default: 0,    select: false },
    lockedUntil:         { type: Date,   default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password; delete ret.refreshToken
        delete ret.passwordResetCode; delete ret.passwordResetExpires
        delete ret.failedLoginAttempts; delete ret.lockedUntil
        delete ret.__v
        return ret
      },
    },
    toObject: { virtuals: true },
  }
)

userSchema.index({ username: 1 })
userSchema.index({ role:     1 })
userSchema.index({ status:   1 })
userSchema.index({ createdAt:-1 })

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()
  this.password = await hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  return compare(plain, this.password)
}
userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockedUntil && this.lockedUntil > new Date())
}
userSchema.methods.registerFailedLogin = async function (): Promise<void> {
  this.failedLoginAttempts = (this.failedLoginAttempts ?? 0) + 1
  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000)
  }
  await this.save()
}
userSchema.methods.clearFailedLogins = async function (): Promise<void> {
  if (this.failedLoginAttempts !== 0 || this.lockedUntil) {
    this.failedLoginAttempts = 0
    this.lockedUntil         = null
    this.lastLoginAt         = new Date()
    this.isFirstLogin        = false
    await this.save()
  }
}

const User = model("user", userSchema)
export default User