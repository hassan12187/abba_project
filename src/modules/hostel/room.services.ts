import { FilterQuery, SortOrder } from "mongoose"
import "../../models/Amenities.js"
import roomModel        from "./room.model.js"
import HostelBlockModel from "./hostelBlock.model.js"
import {
  IRoom, RoomFilters, RoomStatus,
  CreateRoomDTO, UpdateRoomDTO, UpdateRoomStatusDTO,
  PaginatedResult,
} from "./types.js"
import { HttpError } from "../../utils/errors.js"

// ─── Allowed status transitions ───────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available:   ["occupied", "maintenance"],
  occupied:    ["maintenance"],             // must vacate occupants first to set available
  maintenance: ["available"],
}

export const RoomService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  /**
   * Paginated list with block, type, status, and availability filters.
   * Pass available=true to get only rooms with remaining beds.
   */
  async getAll(filters: RoomFilters): Promise<PaginatedResult<IRoom>> {
    const {
      block_id, type, status, available, search,
      page = 1, limit = 10,
      sortBy = "room_no", sortOrder = "asc",
    } = filters

    const query: FilterQuery<IRoom> = {}
    if (block_id) query.block_id = block_id
    if (type)     query.type     = type
    if (status)   query.status   = status
    if (search)   query.room_no  = { $regex: search, $options: "i" }

    // available=true: rooms where occupants.length < capacity
    if (available === true) {
      query.$expr = { $lt: [{ $size: { $ifNull: ["$occupants", []] } }, "$capacity"] }
    }

    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder === "asc" ? 1 : -1 }
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      roomModel
        .find(query)
        .populate("block_id",   "block_no status")
        .populate("occupants",  "student_name student_roll_no status")
        .populate("amenities",  "name")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      roomModel.countDocuments(query),
    ])

    return { data: data as IRoom[], total, page, limit, totalPages: Math.ceil(total / limit) }
  },

  /**
   * All rooms in a specific block — used by frontend room selector.
   */
  async getByBlock(blockId: string, availableOnly = false): Promise<IRoom[]> {
    const block = await HostelBlockModel.findById(blockId)
    if (!block) throw HttpError.notFound(`Block with id '${blockId}' not found.`)

    const query: FilterQuery<IRoom> = { block_id: blockId }
    if (availableOnly) {
      query.$expr = { $lt: [{ $size: { $ifNull: ["$occupants", []] } }, "$capacity"] }
    }

    const rooms = await roomModel
      .find(query)
      .populate("occupants", "student_name student_roll_no")
      .sort({ room_no: 1 })
      .lean({ virtuals: true })

    return rooms as IRoom[]
  },

  /**
   * Single room fully populated.
   */
  async getById(id: string): Promise<IRoom> {
    const room = await roomModel
      .findById(id)
      .populate("block_id",           "block_no status description")
      .populate("occupants",          "student_name student_roll_no student_email status")
      .populate("amenities",          "name description")
      // .populate("maintenance_record", "title status date")
      .lean({ virtuals: true })

    if (!room) throw HttpError.notFound(`Room with id '${id}' not found.`)
    return room as IRoom
  },

  /**
   * Room stats across all rooms or within a specific block.
   */
  async getStats(blockId?: string) {
    const match = blockId ? { block_id: blockId } : {}

    const [statusBreakdown, typeBreakdown, capacityStats] = await Promise.all([
      roomModel.aggregate([
        { $match: match },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      roomModel.aggregate([
        { $match: match },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      roomModel.aggregate([
        { $match: match },
        {
          $group: {
            _id:            null,
            totalCapacity:  { $sum: "$capacity" },
            totalOccupants: { $sum: { $size: { $ifNull: ["$occupants", []] } } },
            totalRooms:     { $sum: 1 },
            avgFees:        { $avg: "$fees" },
          },
        },
      ]),
    ])

    const stats = capacityStats[0] ?? {
      totalCapacity: 0, totalOccupants: 0, totalRooms: 0, avgFees: 0,
    }

    return {
      byStatus:         Object.fromEntries(statusBreakdown.map(({ _id, count }) => [_id, count])),
      byType:           Object.fromEntries(typeBreakdown.map(({ _id, count }) => [_id, count])),
      totalCapacity:    stats.totalCapacity,
      totalOccupants:   stats.totalOccupants,
      availableBeds:    stats.totalCapacity - stats.totalOccupants,
      occupancyRate:    stats.totalCapacity > 0
        ? Math.round((stats.totalOccupants / stats.totalCapacity) * 100)
        : 0,
      avgFees:          Math.round(stats.avgFees * 100) / 100,
      totalRooms:       stats.totalRooms,
    }
  },

  // ── WRITE ───────────────────────────────────────────────────────────────────

  async create(dto: CreateRoomDTO): Promise<IRoom> {
    // Verify block exists
    const block = await HostelBlockModel.findById(dto.block_id)
    if (!block) throw HttpError.notFound(`Block with id '${dto.block_id}' not found.`)

    if (block.status === "under construction") {
      throw HttpError.forbidden(
        `Block '${block.block_no}' is under construction. Rooms can only be created in 'ready' or 'maintenance' blocks.`
      )
    }

    // room_no must be unique within the block
    const duplicate = await roomModel.findOne({ room_no: dto.room_no, block_id: dto.block_id })
    if (duplicate) {
      throw HttpError.conflict(
        `Room '${dto.room_no}' already exists in block '${block.block_no}'.`
      )
    }

    const room = await roomModel.create(dto)
    return room.toObject({ virtuals: true }) as IRoom
  },

  /**
   * Bulk create rooms for a block — seeds a full floor at once.
   */
  async bulkCreate(
    blockId: string,
    rooms:   Omit<CreateRoomDTO, "block_id">[]
  ): Promise<{ created: number; skipped: string[] }> {
    const block = await HostelBlockModel.findById(blockId)
    if (!block) throw HttpError.notFound(`Block with id '${blockId}' not found.`)

    // Filter out room numbers that already exist in this block
    const existingRooms = await roomModel
      .find({ block_id: blockId })
      .select("room_no")
      .lean()

    const existingNos = new Set(existingRooms.map((r) => r.room_no))
    const skipped:   string[] = []
    const toCreate:  any[]    = []

    for (const room of rooms) {
      if (existingNos.has(room.room_no)) {
        skipped.push(room.room_no)
      } else {
        toCreate.push({ ...room, block_id: blockId })
      }
    }

    if (toCreate.length > 0) await roomModel.insertMany(toCreate)

    return { created: toCreate.length, skipped }
  },

  async update(id: string, dto: UpdateRoomDTO): Promise<IRoom> {
    const room = await roomModel.findById(id).select("block_id room_no")
    if (!room) throw HttpError.notFound(`Room with id '${id}' not found.`)

    // Prevent duplicate room_no within the same block
    if (dto.room_no) {
      const conflict = await roomModel.findOne({
        room_no:  dto.room_no,
        block_id: room.block_id,
        _id:      { $ne: id },
      })
      if (conflict) {
        throw HttpError.conflict(`Room '${dto.room_no}' already exists in this block.`)
      }
    }

    // Capacity cannot be reduced below current occupant count
    if (dto.capacity !== undefined) {
      const current = await roomModel.findById(id).select("occupants")
      if (current && dto.capacity < current.occupants.length) {
        throw HttpError.badRequest(
          `Cannot reduce capacity to ${dto.capacity} — room currently has ${current.occupants.length} occupant(s).`
        )
      }
    }

    const updated = await roomModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .populate("block_id", "block_no")
      .lean({ virtuals: true })

    return updated as IRoom
  },

  /**
   * Controlled status transition.
   * Cannot set to 'available' if occupants are present — vacate them first.
   */
  async updateStatus(id: string, dto: UpdateRoomStatusDTO): Promise<IRoom> {
    const room = await roomModel.findById(id)
    if (!room) throw HttpError.notFound(`Room with id '${id}' not found.`)

    const current = room.status as RoomStatus
    const next    = dto.status

    if (current === next) throw HttpError.badRequest(`Room is already '${next}'.`)

    const allowed = ALLOWED_TRANSITIONS[current]
    if (!allowed.includes(next)) {
      throw HttpError.badRequest(
        `Cannot transition from '${current}' to '${next}'. Allowed: ${allowed.join(", ")}.`
      )
    }

    if (next === "available" && room.occupants.length > 0) {
      throw HttpError.badRequest(
        `Cannot set to 'available' — room has ${room.occupants.length} occupant(s). Remove them first.`
      )
    }

    room.status = next
    await room.save()

    return room.toObject({ virtuals: true }) as IRoom
  },

  /**
   * Delete — only allowed if the room has no occupants.
   */
  async delete(id: string): Promise<void> {
    const room = await roomModel.findById(id)
    if (!room) throw HttpError.notFound(`Room with id '${id}' not found.`)

    if (room.occupants.length > 0) {
      throw HttpError.forbidden(
        `Cannot delete room '${room.room_no}' — it has ${room.occupants.length} occupant(s). Vacate the room first.`
      )
    }

    await room.deleteOne()
  },
}