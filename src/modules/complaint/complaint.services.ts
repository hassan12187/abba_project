import { FilterQuery, SortOrder } from "mongoose"
import ComplaintModel from "./complaint.model.js"
import redis          from "../../services/Redis.js"
import { HttpError }  from "../../utils/errors.js"
import type {
  CreateComplaintDTO, UpdateComplaintDTO, UpdateStatusDTO,
  ComplaintFilters, Complaint,
  PaginatedComplaintsResponse,
} from "./complaint.types.js"

// ─── Cache config ─────────────────────────────────────────────────────────────
//
//  "complaint:list:<fingerprint>"  TTL 2 min  — paginated list pages
//  "complaint:stats"               TTL 5 min  — dashboard stat aggregations
//  "complaint:detail:<id>"         TTL 5 min  — single complaint detail
//
// Every write invalidates list + stats. Update/delete also drop the detail key.

const CACHE_PREFIX_LIST   = "complaint:list:"
const CACHE_KEY_STATS     = "complaint:stats"
const CACHE_PREFIX_DETAIL = "complaint:detail:"

const TTL_LIST   = 2 * 60
const TTL_STATS  = 5 * 60
const TTL_DETAIL = 5 * 60

async function invalidatePrefix(prefix: string): Promise<void> {
  let cursor = "0"
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100)
    cursor = next
    if (keys.length) await redis.del(...keys)
  } while (cursor !== "0")
}

async function invalidateOnWrite(id?: string): Promise<void> {
  const ops: Promise<any>[] = [
    invalidatePrefix(CACHE_PREFIX_LIST),
    redis.del(CACHE_KEY_STATS),
  ]
  if (id) ops.push(redis.del(`${CACHE_PREFIX_DETAIL}${id}`))
  await Promise.all(ops)
}

function filtersKey(f: ComplaintFilters): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(f)
        .filter(([, v]) => v !== undefined && v !== "" && v !== null)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  )
}

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0);      return r }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r }

// Priority weight for sort — "high" should appear first when sortBy=priority
const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 }

// ─── Service ──────────────────────────────────────────────────────────────────
export const ComplaintService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  async getAll(filters: ComplaintFilters): Promise<PaginatedComplaintsResponse> {
    const cacheKey = `${CACHE_PREFIX_LIST}${filtersKey(filters)}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const {
      status, priority, category, search,
      from, to,
      page = 1, limit = 15,
      sortBy = "createdAt", sortOrder = "desc",
    } = filters

    const query: FilterQuery<any> = {}

    if (status   && status !== "All") query.status   = status
    if (priority)                     query.priority  = priority
    if (category)                     query.category  = category
    if (search)                       query.title     = { $regex: search.trim(), $options: "i" }

    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = startOfDay(new Date(from))
      if (to)   query.createdAt.$lte = endOfDay(new Date(to))
    }

    // Priority sort uses numeric weight; other fields sort naturally
    const sort: Record<string, SortOrder> =
      sortBy === "priority"
        ? { priority: sortOrder === "asc" ? 1 : -1 }   // Mongoose sorts enum strings alphabetically;
        : { [sortBy]: sortOrder === "asc" ? 1 : -1 }    // handled below via addFields in aggregation

    const skip = (page - 1) * limit

    // Use aggregation when sorting by priority so we can map to numeric weight
    let data: any[], total: number

    if (sortBy === "priority") {
      const weightExpr = {
        $switch: {
          branches: [
            { case: { $eq: ["$priority", "high"]   }, then: 3 },
            { case: { $eq: ["$priority", "medium"] }, then: 2 },
          ],
          default: 1,
        },
      }

      const pipeline: any[] = [
        { $match: query },
        { $addFields: { _priorityWeight: weightExpr } },
        { $sort: { _priorityWeight: sortOrder === "asc" ? 1 : -1, createdAt: -1 } },
        {
          $lookup: {
            from:         "student_applications",
            localField:   "student_id",
            foreignField: "_id",
            as:           "student_id",
            pipeline:     [{ $project: { student_name: 1, student_roll_no: 1, student_email: 1 } }],
          },
        },
        { $unwind: { path: "$student_id", preserveNullAndEmpty: true } },
        {
          $lookup: {
            from:         "rooms",
            localField:   "room_id",
            foreignField: "_id",
            as:           "room_id",
            pipeline:     [{ $project: { room_no: 1, floor: 1, block: 1 } }],
          },
        },
        { $unwind: { path: "$room_id", preserveNullAndEmpty: true } },
        { $project: { _priorityWeight: 0 } },
        { $facet: {
          data:  [{ $skip: skip }, { $limit: limit }],
          count: [{ $count: "total" }],
        }},
      ]

      const [result] = await ComplaintModel.aggregate(pipeline)
      data  = result?.data  ?? []
      total = result?.count?.[0]?.total ?? 0
    } else {
      ;[data, total] = await Promise.all([
        ComplaintModel.find(query)
          .populate("student_id", "student_name student_roll_no student_email")
          .populate("room_id",    "room_no floor block")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        ComplaintModel.countDocuments(query),
      ])
    }

    const result: PaginatedComplaintsResponse = {
      success:    true,
      data:       data as unknown as Complaint[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    await redis.set(cacheKey, JSON.stringify(result), "EX", TTL_LIST)
    return result
  },

  async getById(id: string): Promise<Complaint> {
    const cacheKey = `${CACHE_PREFIX_DETAIL}${id}`
    const cached   = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const complaint = await ComplaintModel.findById(id)
      .populate("student_id", "student_name student_roll_no student_email student_cellphone")
      .populate("room_id",    "room_no floor block")
      .lean()

    if (!complaint) throw HttpError.notFound(`Complaint ${id} not found.`)

    await redis.set(cacheKey, JSON.stringify(complaint), "EX", TTL_DETAIL)
    return complaint as unknown as Complaint
  },

  async getStats() {
    const cached = await redis.get(CACHE_KEY_STATS)
    if (cached) return JSON.parse(cached)

    const [byStatus, byPriority, byCategory, resolutionTime, pendingHigh] = await Promise.all([
      ComplaintModel.aggregate([
        { $group: { _id: "$status",   count: { $sum: 1 } } },
      ]),
      ComplaintModel.aggregate([
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      ComplaintModel.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      // Average resolution time in hours (only resolved complaints)
      ComplaintModel.aggregate([
        { $match: { status: "Resolved", resolved_at: { $ne: null } } },
        { $project: {
          hours: {
            $divide: [
              { $subtract: ["$resolved_at", "$createdAt"] },
              3600000,  // ms → hours
            ],
          },
        }},
        { $group: { _id: null, avg: { $avg: "$hours" } } },
      ]),
      // Count of high-priority pending complaints (for alert badge)
      ComplaintModel.countDocuments({ status: "Pending", priority: "high" }),
    ])

    const toRecord = (arr: { _id: string; count: number }[]) =>
      Object.fromEntries(arr.map(({ _id, count }) => [_id, count]))

    const result = {
      byStatus:            toRecord(byStatus),
      byPriority:          toRecord(byPriority),
      byCategory:          toRecord(byCategory),
      total:               byStatus.reduce((s, x) => s + x.count, 0),
      avgResolutionHours:  resolutionTime[0]?.avg != null
                             ? Math.round(resolutionTime[0].avg * 10) / 10
                             : null,
      pendingHighPriority: pendingHigh,
    }

    await redis.set(CACHE_KEY_STATS, JSON.stringify(result), "EX", TTL_STATS)
    return result
  },

  // ── WRITE ───────────────────────────────────────────────────────────────────

  async create(dto: CreateComplaintDTO): Promise<Complaint> {
    const complaint = await ComplaintModel.create({
      student_id:     dto.student_id,
      room_id:        dto.room_id,
      title:          dto.title,
      description:    dto.description,
      priority:       dto.priority ?? "medium",
      category:       dto.category ?? "other",
      status:         "Pending",
      status_history: [{ status: "Pending", note: "Complaint submitted." }],
    })

    await invalidateOnWrite()

    return ComplaintService.getById(complaint._id.toString())
  },

  async update(id: string, dto: UpdateComplaintDTO): Promise<Complaint> {
    const update: Record<string, any> = {}
    if (dto.title          !== undefined) update.title          = dto.title
    if (dto.description    !== undefined) update.description    = dto.description
    if (dto.priority       !== undefined) update.priority       = dto.priority
    if (dto.category       !== undefined) update.category       = dto.category
    if (dto.assigned_to    !== undefined) update.assigned_to    = dto.assigned_to
    if (dto.admin_comments !== undefined) update.admin_comments = dto.admin_comments

    const complaint = await ComplaintModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean()

    if (!complaint) throw HttpError.notFound(`Complaint ${id} not found.`)

    await invalidateOnWrite(id)
    return ComplaintService.getById(id)
  },

  async updateStatus(id: string, dto: UpdateStatusDTO): Promise<Complaint> {
    // Fetch current status for the transition guard in the controller
    const existing = await ComplaintModel.findById(id, { status: 1 }).lean()
    if (!existing) throw HttpError.notFound(`Complaint ${id} not found.`)

    const update: Record<string, any> = {
      status: dto.status,
    }
    if (dto.admin_comments !== undefined) update.admin_comments = dto.admin_comments
    if (dto.status === "Resolved")        update.resolved_at    = new Date()

    const complaint = await ComplaintModel.findByIdAndUpdate(
      id,
      {
        $set:  update,
        // Append to audit trail
        $push: {
          status_history: {
            status:     dto.status,
            changed_at: new Date(),
            note:       dto.note ?? `Status changed to ${dto.status}.`,
          },
        },
      },
      { new: true, runValidators: true }
    ).lean()

    if (!complaint) throw HttpError.notFound(`Complaint ${id} not found.`)

    await invalidateOnWrite(id)
    return ComplaintService.getById(id)
  },

  async delete(id: string): Promise<void> {
    const deleted = await ComplaintModel.findByIdAndDelete(id)
    if (!deleted) throw HttpError.notFound(`Complaint ${id} not found.`)
    await invalidateOnWrite(id)
  },
}