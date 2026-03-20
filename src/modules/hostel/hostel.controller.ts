import { Request, Response, NextFunction } from "express"
import { BlockService } from "./block.services.js"
import { RoomService  } from "./room.services.js"
import { BlockFilters, RoomFilters } from "./types.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK CONTROLLERS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /blocks/stats */
export const getBlockStats = asyncHandler(async (_req, res) => {
  const stats = await BlockService.getStats()
  res.status(200).json({ success: true, data: stats })
})

/** GET /blocks/overview — all blocks with room counts */
export const getBlocksOverview = asyncHandler(async (_req, res) => {
  const blocks = await BlockService.getAllWithSummary()
  res.status(200).json({ success: true, data: blocks })
})

/** GET /blocks */
export const getAllBlocks = asyncHandler(async (req, res) => {
  const filters: BlockFilters = {
    status:    req.query.status    as BlockFilters["status"],
    search:    req.query.search    as string,
    page:      Number(req.query.page)  || 1,
    limit:     Number(req.query.limit) || 10,
    sortBy:    req.query.sortBy    as BlockFilters["sortBy"],
    sortOrder: req.query.sortOrder as BlockFilters["sortOrder"],
  }
  const result = await BlockService.getAll(filters)
  res.status(200).json({ success: true, ...result })
})

/** GET /blocks/:id */
export const getBlockById = asyncHandler(async (req, res) => {
  const block = await BlockService.getById(req.params.id)
  res.status(200).json({ success: true, data: block })
})

/** GET /blocks/:id/summary */
export const getBlockSummary = asyncHandler(async (req, res) => {
  const summary = await BlockService.getWithSummary(req.params.id)
  res.status(200).json({ success: true, data: summary })
})

/** POST /blocks */
export const createBlock = asyncHandler(async (req, res) => {
  const block = await BlockService.create(req.body)
  res.status(201).json({
    success: true,
    message: `Block '${block.block_no}' created successfully.`,
    data:    block,
  })
})

/** PATCH /blocks/:id */
export const updateBlock = asyncHandler(async (req, res) => {
  const block = await BlockService.update(req.params.id, req.body)
  res.status(200).json({
    success: true,
    message: "Block updated successfully.",
    data:    block,
  })
})

/** DELETE /blocks/:id */
export const deleteBlock = asyncHandler(async (req, res) => {
  await BlockService.delete(req.params.id)
  res.status(200).json({ success: true, message: "Block deleted successfully." })
})

// ═════════════════════════════════════════════════════════════════════════════
// ROOM CONTROLLERS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /rooms/stats?block_id= */
export const getRoomStats = asyncHandler(async (req, res) => {
  const blockId = req.query.block_id as string | undefined
  const stats   = await RoomService.getStats(blockId)
  res.status(200).json({ success: true, data: stats })
})

/** GET /rooms */
export const getAllRooms = asyncHandler(async (req, res) => {
  const filters: RoomFilters = {
    block_id:  req.query.block_id  as string,
    type:      req.query.type      as RoomFilters["type"],
    status:    req.query.status    as RoomFilters["status"],
    available: req.query.available as unknown as boolean,
    search:    req.query.search    as string,
    page:      Number(req.query.page)  || 1,
    limit:     Number(req.query.limit) || 10,
    sortBy:    req.query.sortBy    as RoomFilters["sortBy"],
    sortOrder: req.query.sortOrder as RoomFilters["sortOrder"],
  }
  const result = await RoomService.getAll(filters)
  res.status(200).json({ success: true, ...result })
})

/** GET /rooms/:id */
export const getRoomById = asyncHandler(async (req, res) => {
  const room = await RoomService.getById(req.params.id)
  res.status(200).json({ success: true, data: room })
})

/** GET /blocks/:blockId/rooms — rooms within a specific block */
export const getRoomsByBlock = asyncHandler(async (req, res) => {
  const availableOnly = req.query.available === "true"
  const rooms = await RoomService.getByBlock(req.params.blockId, availableOnly)
  res.status(200).json({ success: true, data: rooms })
})

/** POST /rooms */
export const createRoom = asyncHandler(async (req, res) => {
  const room = await RoomService.create(req.body)
  res.status(201).json({
    success: true,
    message: `Room '${room.room_no}' created successfully.`,
    data:    room,
  })
})

/** POST /blocks/:blockId/rooms/bulk */
export const bulkCreateRooms = asyncHandler(async (req, res) => {
  const result = await RoomService.bulkCreate(req.params.blockId, req.body.rooms)
  res.status(201).json({
    success: true,
    message: `${result.created} room(s) created.${result.skipped.length ? ` Skipped (already exist): ${result.skipped.join(", ")}.` : ""}`,
    data:    result,
  })
})

/** PATCH /rooms/:id */
export const updateRoom = asyncHandler(async (req, res) => {
  const room = await RoomService.update(req.params.id, req.body)
  res.status(200).json({
    success: true,
    message: "Room updated successfully.",
    data:    room,
  })
})

/** PATCH /rooms/:id/status */
export const updateRoomStatus = asyncHandler(async (req, res) => {
  const room = await RoomService.updateStatus(req.params.id, req.body)
  res.status(200).json({
    success: true,
    message: `Room status changed to '${req.body.status}'.`,
    data:    room,
  })
})

/** DELETE /rooms/:id */
export const deleteRoom = asyncHandler(async (req, res) => {
  await RoomService.delete(req.params.id)
  res.status(200).json({ success: true, message: "Room deleted successfully." })
})