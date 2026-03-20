import { FilterQuery, SortOrder } from "mongoose"
import HostelBlockModel from "./hostelBlock.model.js"
import roomModel        from "./room.model.js"
import {
  IHostelBlock, BlockFilters, BlockSummary,
  BlockStats, CreateBlockDTO, UpdateBlockDTO, BlockStatus,
  PaginatedResult,
} from "./types.js"
import { HttpError } from "../../utils/errors.js"

export const BlockService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  /**
   * Paginated list with optional status / search filters.
   */
  async getAll(filters: BlockFilters): Promise<PaginatedResult<IHostelBlock>> {
    const {
      status, search,
      page = 1, limit = 10,
      sortBy = "createdAt", sortOrder = "desc",
    } = filters

    const query: FilterQuery<IHostelBlock> = {}
    if (status) query.status = status
    if (search) {
      query.$or = [
        { block_no:    { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ]
    }

    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder === "asc" ? 1 : -1 }
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      HostelBlockModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
      HostelBlockModel.countDocuments(query),
    ])

    return { data: data as IHostelBlock[], total, page, limit, totalPages: Math.ceil(total / limit) }
  },

  /**
   * Single block by ID.
   */
  async getById(id: string): Promise<IHostelBlock> {
    const block = await HostelBlockModel.findById(id).lean()
    if (!block) throw HttpError.notFound(`Block with id '${id}' not found.`)
    return block as IHostelBlock
  },

  /**
   * Block with room counts — used for admin dashboard cards.
   */
  async getWithSummary(id: string): Promise<BlockSummary> {
    const block = await HostelBlockModel.findById(id).lean()
    if (!block) throw HttpError.notFound(`Block with id '${id}' not found.`)

    const [roomStats] = await roomModel.aggregate([
      { $match: { block_id: block._id } },
      {
        $group: {
          _id:             null,
          room_count:      { $sum: 1 },
          available_rooms: { $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] } },
          occupied_rooms:  { $sum: { $cond: [{ $eq: ["$status", "occupied"]  }, 1, 0] } },
          total_occupants: { $sum: { $size: { $ifNull: ["$occupants", []] } } },
        },
      },
    ])

    return {
      ...(block as IHostelBlock),
      room_count:      roomStats?.room_count      ?? 0,
      available_rooms: roomStats?.available_rooms ?? 0,
      occupied_rooms:  roomStats?.occupied_rooms  ?? 0,
      total_occupants: roomStats?.total_occupants ?? 0,
    }
  },

  /**
   * All blocks with their room counts in one aggregation — for the overview table.
   */
  async getAllWithSummary(): Promise<BlockSummary[]> {
    return HostelBlockModel.aggregate([
      {
        $lookup: {
          from:         "rooms",
          localField:   "_id",
          foreignField: "block_id",
          as:           "rooms",
        },
      },
      {
        $addFields: {
          room_count: { $size: "$rooms" },
          available_rooms: {
            $size: {
              $filter: { input: "$rooms", as: "r", cond: { $eq: ["$$r.status", "available"] } },
            },
          },
          occupied_rooms: {
            $size: {
              $filter: { input: "$rooms", as: "r", cond: { $eq: ["$$r.status", "occupied"] } },
            },
          },
          total_occupants: {
            $sum: {
              $map: { input: "$rooms", as: "r", in: { $size: { $ifNull: ["$$r.occupants", []] } } },
            },
          },
        },
      },
      { $project: { rooms: 0 } },       // remove the joined array from response
      { $sort:    { block_no: 1 } },
    ])
  },

  /**
   * Dashboard stats across all blocks.
   */
  async getStats(): Promise<BlockStats> {
    const [statusBreakdown, totals] = await Promise.all([
      HostelBlockModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      roomModel.aggregate([
        {
          $group: {
            _id:             null,
            totalRooms:      { $sum: 1 },
            totalOccupants:  { $sum: { $size: { $ifNull: ["$occupants", []] } } },
          },
        },
      ]),
    ])

    return {
      total:          await HostelBlockModel.countDocuments(),
      byStatus:       Object.fromEntries(statusBreakdown.map(({ _id, count }) => [_id, count])) as Record<BlockStatus, number>,
      totalRooms:     totals[0]?.totalRooms     ?? 0,
      totalOccupants: totals[0]?.totalOccupants ?? 0,
    }
  },

  // ── WRITE ───────────────────────────────────────────────────────────────────

  async create(dto: CreateBlockDTO): Promise<IHostelBlock> {
    const existing = await HostelBlockModel.findOne({ block_no: dto.block_no }).lean()
    if (existing) throw HttpError.conflict(`Block '${dto.block_no}' already exists.`)

    const block = await HostelBlockModel.create(dto)
    return block.toObject() as IHostelBlock
  },

  async update(id: string, dto: UpdateBlockDTO): Promise<IHostelBlock> {
    // Prevent duplicate block_no if changing it
    if (dto.block_no) {
      const conflict = await HostelBlockModel.findOne({ block_no: dto.block_no, _id: { $ne: id } })
      if (conflict) throw HttpError.conflict(`Block number '${dto.block_no}' is already in use.`)
    }

    const updated = await HostelBlockModel.findByIdAndUpdate(
      id, { $set: dto }, { new: true, runValidators: true }
    ).lean()

    if (!updated) throw HttpError.notFound(`Block with id '${id}' not found.`)
    return updated as IHostelBlock
  },

  /**
   * Delete — only allowed if the block has no rooms.
   */
  async delete(id: string): Promise<void> {
    const block = await HostelBlockModel.findById(id)
    if (!block) throw HttpError.notFound(`Block with id '${id}' not found.`)

    const roomCount = await roomModel.countDocuments({ block_id: id })
    if (roomCount > 0) {
      throw HttpError.forbidden(
        `Cannot delete block '${block.block_no}' — it has ${roomCount} room(s). Remove all rooms first.`
      )
    }

    await block.deleteOne()
  },
}