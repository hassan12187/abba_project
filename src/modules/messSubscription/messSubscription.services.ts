import MessSubscription from "./MessSubscription.model.js"
import redis             from "../../services/Redis.js"
import {
  IMessSubscription, CreateSubscriptionDTO, UpdateSubscriptionDTO,
  SubscriptionFilters, PaginatedResult, SubscriptionStatus,
} from "./types.js"
import { HttpError } from "../../utils/errors.js"

// ─── Cache keys & TTLs ────────────────────────────────────────────────────────
// All keys under "sub:" — invalidateAll() wipes them in one SCAN pass.
const CACHE = {
  stats:        "sub:stats",
  expiringSoon: (days: number) => `sub:expiring:${days}`,
  // List results are keyed by the full filter shape so different filter
  // combinations don't collide with each other.
  list: (filters: SubscriptionFilters) =>
    `sub:list:${JSON.stringify(filters)}`,
}

const TTL = {
  stats:        5 * 60,    // 5 min — counts change with every status mutation
  list:         2 * 60,    // 2 min — short TTL since admins act on this data
  expiringSoon: 10 * 60,   // 10 min
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

async function setCache(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl)
  } catch { /* swallow */ }
}

/** Wipes every key under the "sub:" namespace after any write. */
async function invalidateAll(): Promise<void> {
  try {
    let cursor = "0"
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", "sub:*", "COUNT", 100)
      cursor = next
      if (keys.length) await redis.del(...keys)
    } while (cursor !== "0")
  } catch { /* swallow */ }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  Active:    ["Cancelled", "Suspended"],
  Suspended: ["Active", "Cancelled"],
  Cancelled: [],
}

const PLAN_DURATION_DAYS: Record<string, number> = {
  Monthly:      30,
  Semester:     180,
  Pay_Per_Meal: 1,
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const MessSubscriptionService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  /**
   * Paginated list — cached per unique filter combination for 2 minutes.
   * Short TTL because admins immediately act on this data after status changes.
   */
  async getAll(filters: SubscriptionFilters): Promise<PaginatedResult<IMessSubscription>> {
    const cacheKey = CACHE.list(filters)
    const cached   = await getCache<PaginatedResult<IMessSubscription>>(cacheKey)
    if (cached) return cached

    const {
      status, planType, expiringBefore,
      page = 1, limit = 10,
      sortBy = "createdAt", sortOrder = "desc",
    } = filters

    const query: Record<string, unknown> = {}
    if (status)        query.status   = status
    if (planType)      query.planType = planType
    if (expiringBefore) query.validUntil = { $lte: expiringBefore }

    const sort  = { [sortBy]: sortOrder === "asc" ? 1 : -1 } as Record<string, 1 | -1>
    const skip  = (page - 1) * limit

    const [data, total] = await Promise.all([
      MessSubscription.find(query)
        .populate("student", "name email rollNo")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      MessSubscription.countDocuments(query),
    ])

    const result: PaginatedResult<IMessSubscription> = {
      data: data as IMessSubscription[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    await setCache(cacheKey, result, TTL.list)
    return result
  },

  /**
   * Single subscription — NOT cached individually.
   * Detail views are rare and always need fresh data (especially post-payment).
   */
  async getById(id: string): Promise<IMessSubscription> {
    const sub = await MessSubscription.findById(id)
      .populate("student", "name email rollNo")
      .lean()
    if (!sub) throw HttpError.notFound(`Subscription with id '${id}' not found.`)
    return sub as IMessSubscription
  },

  async getByStudentId(studentId: string): Promise<IMessSubscription> {
    const sub = await MessSubscription.findOne({ student: studentId })
      .populate("student", "name email rollNo")
      .lean()
    if (!sub) throw HttpError.notFound(`No subscription found for student '${studentId}'.`)
    return sub as IMessSubscription
  },

  /**
   * Stats — cached for 5 minutes.
   * Invalidated on every write so counts don't lag after status transitions.
   */
  async getStats() {
    const cached = await getCache<ReturnType<typeof MessSubscriptionService.getStats>>(CACHE.stats)
    if (cached) return cached

    const [statusBreakdown, planBreakdown, revenueStats] = await Promise.all([
      MessSubscription.aggregate([{ $group: { _id: "$status",   count: { $sum: 1 } } }]),
      MessSubscription.aggregate([{ $group: { _id: "$planType", count: { $sum: 1 } } }]),
      MessSubscription.aggregate([
        { $match: { status: "Active" } },
        { $group: { _id: null, totalMonthlyRevenue: { $sum: "$monthlyFee" }, avgMonthlyFee: { $avg: "$monthlyFee" }, activeCount: { $sum: 1 } } },
      ]),
    ])

    const result = {
      byStatus: Object.fromEntries(statusBreakdown.map(({ _id, count }) => [_id, count])),
      byPlan:   Object.fromEntries(planBreakdown.map(({ _id, count }) => [_id, count])),
      revenue:  revenueStats[0] ?? { totalMonthlyRevenue: 0, avgMonthlyFee: 0, activeCount: 0 },
    }

    await setCache(CACHE.stats, result, TTL.stats)
    return result
  },

  /**
   * Expiring-soon list — cached per `withinDays` value for 10 minutes.
   */
  async getExpiringSoon(withinDays: number): Promise<IMessSubscription[]> {
    const cacheKey = CACHE.expiringSoon(withinDays)
    const cached   = await getCache<IMessSubscription[]>(cacheKey)
    if (cached) return cached

    const now       = new Date()
    const threshold = addDays(now, withinDays)

    const subs = await MessSubscription.find({
      status:     "Active",
      validUntil: { $gte: now, $lte: threshold },
    }).populate("student", "name email rollNo").lean()

    await setCache(cacheKey, subs, TTL.expiringSoon)
    return subs as IMessSubscription[]
  },

  // ── WRITE (all invalidate the full "sub:" namespace) ────────────────────────

  async create(dto: CreateSubscriptionDTO): Promise<IMessSubscription> {
    const existing = await MessSubscription.findOne({ student: dto.student }).lean()
    if (existing) throw HttpError.conflict("A subscription already exists for this student.")

    const planType  = dto.planType ?? "Monthly"
    const validUntil = dto.validUntil ?? addDays(new Date(), PLAN_DURATION_DAYS[planType])

    const sub = await MessSubscription.create({ student: dto.student, planType, monthlyFee: dto.monthlyFee, validUntil })

    await invalidateAll()
    return sub.toObject() as IMessSubscription
  },

  async update(id: string, dto: UpdateSubscriptionDTO): Promise<IMessSubscription> {
    if ("status" in dto) throw HttpError.badRequest("Use PATCH /subscriptions/:id/status to change status.")

    if ((dto as any).student_email) {
      const conflict = await MessSubscription.findOne({ student_email: (dto as any).student_email, _id: { $ne: id } })
      if (conflict) throw HttpError.conflict("Email already in use.")
    }

    const updated = await MessSubscription.findByIdAndUpdate(
      id, { $set: dto }, { new: true, runValidators: true }
    ).populate("student", "name email rollNo").lean()

    if (!updated) throw HttpError.notFound(`Subscription with id '${id}' not found.`)

    await invalidateAll()
    return updated as IMessSubscription
  },

  async transitionStatus(id: string, newStatus: SubscriptionStatus): Promise<IMessSubscription> {
    const sub = await MessSubscription.findById(id)
    if (!sub) throw HttpError.notFound(`Subscription with id '${id}' not found.`)

    const current = sub.status as SubscriptionStatus
    if (current === newStatus) throw HttpError.badRequest(`Subscription is already '${newStatus}'.`)

    const allowed = ALLOWED_TRANSITIONS[current]
    if (!allowed.includes(newStatus))
      throw HttpError.badRequest(
        `Cannot transition from '${current}' to '${newStatus}'. Allowed: ${allowed.length ? allowed.join(", ") : "none"}.`
      )

    sub.status = newStatus
    await sub.save()

    await invalidateAll()
    return sub.toObject() as IMessSubscription
  },

  async suspendExpired(): Promise<{ modifiedCount: number }> {
    const result = await MessSubscription.updateMany(
      { status: "Active", validUntil: { $lt: new Date() } },
      { $set: { status: "Suspended" } }
    )
    await invalidateAll()
    return { modifiedCount: result.modifiedCount }
  },

  async delete(id: string): Promise<void> {
    const sub = await MessSubscription.findById(id).select("status")
    if (!sub) throw HttpError.notFound(`Subscription with id '${id}' not found.`)
    if (sub.status !== "Cancelled") throw HttpError.forbidden("Only 'Cancelled' subscriptions can be deleted.")

    await sub.deleteOne()
    await invalidateAll()
  },
}