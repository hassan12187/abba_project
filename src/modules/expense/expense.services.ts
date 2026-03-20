import { FilterQuery, SortOrder } from "mongoose"
import ExpenseModel              from "./expenseModel.js"
import redis                     from "../../services/Redis.js"
import { HttpError }             from "../../utils/errors.js"
import type {
  CreateExpenseDTO, UpdateExpenseDTO,
  ExpenseFilters, Expense,
  PaginatedExpensesResponse, ExpenseStatsResponse,
} from "./expense.types.js"

// ─── Cache config ─────────────────────────────────────────────────────────────
//
// Cache strategy per route:
//
//   GET /expenses?...   → "expense:list:<fingerprint>"  TTL 2 min
//                          Short TTL because filters vary widely — many possible
//                          keys. We don't want to fill Redis with stale pages.
//
//   GET /expenses/stats → "expense:stats"               TTL 10 min
//                          Stats are expensive (4 aggregations). Safe to cache
//                          longer since they're invalidated on every write.
//
//   GET /expenses/:id   → "expense:detail:<id>"         TTL 5 min
//                          Single doc reads are fast but called often when the
//                          edit panel opens. Invalidated on update/delete.
//
// Invalidation strategy:
//   All list keys share prefix "expense:list:" — on any write we scan+delete
//   the entire prefix so stale pages never show. Detail keys are deleted by id.
//   Stats key is deleted on every write too.

const CACHE_PREFIX_LIST   = "expense:list:"
const CACHE_KEY_STATS     = "expense:stats"
const CACHE_PREFIX_DETAIL = "expense:detail:"

const TTL_LIST   = 2  * 60   //  2 minutes
const TTL_STATS  = 10 * 60   // 10 minutes
const TTL_DETAIL = 5  * 60   //  5 minutes

/** Scan-and-delete all keys matching a prefix (handles any page count). */
async function invalidatePrefix(prefix: string): Promise<void> {
  let cursor = "0"
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor, "MATCH", `${prefix}*`, "COUNT", 100
    )
    cursor = nextCursor
    if (keys.length > 0) await redis.del(...keys)
  } while (cursor !== "0")
}

/** Invalidate everything touched by a write operation. */
async function invalidateOnWrite(expenseId?: string): Promise<void> {
  const ops: Promise<any>[] = [
    invalidatePrefix(CACHE_PREFIX_LIST),
    redis.del(CACHE_KEY_STATS),
  ]
  if (expenseId) ops.push(redis.del(`${CACHE_PREFIX_DETAIL}${expenseId}`))
  await Promise.all(ops)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0);      return r }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r }

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

/** Stable JSON key from filter object — ignores undefined values. */
function filtersKey(filters: ExpenseFilters): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== "")
        .sort(([a], [b]) => a.localeCompare(b))   // stable regardless of insertion order
    )
  )
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const ExpenseService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  async getAll(filters: ExpenseFilters): Promise<PaginatedExpensesResponse> {
    const cacheKey = `${CACHE_PREFIX_LIST}${filtersKey(filters)}`

    // Cache hit
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // Cache miss — query MongoDB
    const {
      category, from, to, search,
      page = 1, limit = 15,
      sortBy = "date", sortOrder = "desc",
    } = filters

    const query: FilterQuery<any> = {}
    if (category) query.category    = category
    if (search)   query.description = { $regex: search.trim(), $options: "i" }
    if (from || to) {
      query.date = {}
      if (from) query.date.$gte = startOfDay(new Date(from))
      if (to)   query.date.$lte = endOfDay(new Date(to))
    }

    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder === "asc" ? 1 : -1 }
    const skip = (page - 1) * limit

    const [data, total, totalAmountAgg] = await Promise.all([
      ExpenseModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
      ExpenseModel.countDocuments(query),
      ExpenseModel.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ])

    const result: PaginatedExpensesResponse = {
      success:     true,
      data:        data as unknown as Expense[],
      total,
      page,
      limit,
      totalPages:  Math.ceil(total / limit),
      totalAmount: Math.round((totalAmountAgg[0]?.total ?? 0) * 100) / 100,
    }

    await redis.set(cacheKey, JSON.stringify(result), "EX", TTL_LIST)
    return result
  },

  async getById(id: string): Promise<Expense> {
    const cacheKey = `${CACHE_PREFIX_DETAIL}${id}`

    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const expense = await ExpenseModel.findById(id).lean()
    if (!expense) throw HttpError.notFound(`Expense ${id} not found.`)

    await redis.set(cacheKey, JSON.stringify(expense), "EX", TTL_DETAIL)
    return expense as unknown as Expense
  },

  async getStats(): Promise<ExpenseStatsResponse["data"]> {
    const cached = await redis.get(CACHE_KEY_STATS)
    if (cached) return JSON.parse(cached)

    const now       = new Date()
    const thisStart = startOfMonth(now)
    const thisEnd   = endOfMonth(now)
    const lastDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastStart = startOfMonth(lastDate)
    const lastEnd   = endOfMonth(lastDate)

    const [breakdown, totals, thisMonth, lastMonth] = await Promise.all([
      ExpenseModel.aggregate([
        { $group: {
          _id:    "$category",
          count:  { $sum: 1 },
          amount: { $sum: "$amount" },
        }},
        { $sort: { amount: -1 } },
      ]),
      ExpenseModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      ExpenseModel.aggregate([
        { $match: { date: { $gte: thisStart, $lte: thisEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      ExpenseModel.aggregate([
        { $match: { date: { $gte: lastStart, $lte: lastEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ])

    const result = {
      byCategory: Object.fromEntries(
        breakdown.map(({ _id, count, amount }) => [
          _id,
          { count, amount: Math.round(amount * 100) / 100 },
        ])
      ) as any,
      totalAmount: Math.round((totals[0]?.total ?? 0) * 100) / 100,
      totalCount:  totals[0]?.count  ?? 0,
      thisMonth:   Math.round((thisMonth[0]?.total ?? 0) * 100) / 100,
      lastMonth:   Math.round((lastMonth[0]?.total ?? 0) * 100) / 100,
    }

    await redis.set(CACHE_KEY_STATS, JSON.stringify(result), "EX", TTL_STATS)
    return result
  },

  // ── WRITE ───────────────────────────────────────────────────────────────────

  async create(dto: CreateExpenseDTO): Promise<Expense> {
    const expense = await ExpenseModel.create({
      description: dto.description,
      amount:      Math.round(dto.amount * 100) / 100,
      category:    dto.category ?? "Miscellaneous",
      date:        dto.date ? new Date(dto.date) : new Date(),
      note:        dto.note,
    })

    // Invalidate list pages + stats (new record changes totals + page counts)
    await invalidateOnWrite()

    return expense.toObject() as unknown as Expense
  },

  async update(id: string, dto: UpdateExpenseDTO): Promise<Expense> {
    const update: Record<string, any> = { ...dto }
    if (dto.amount !== undefined) update.amount = Math.round(dto.amount * 100) / 100
    if (dto.date   !== undefined) update.date   = new Date(dto.date)

    const expense = await ExpenseModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean()

    if (!expense) throw HttpError.notFound(`Expense ${id} not found.`)

    // Invalidate list pages, stats, and the specific detail cache
    await invalidateOnWrite(id)

    return expense as unknown as Expense
  },

  async delete(id: string): Promise<void> {
    const deleted = await ExpenseModel.findByIdAndDelete(id)
    if (!deleted) throw HttpError.notFound(`Expense ${id} not found.`)

    // Invalidate list pages, stats, and the deleted record's detail key
    await invalidateOnWrite(id)
  },
}