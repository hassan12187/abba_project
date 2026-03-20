import { Router } from "express"
import {
  // Block
  getBlockStats, getBlocksOverview, getAllBlocks,
  getBlockById, getBlockSummary,
  createBlock, updateBlock, deleteBlock,
  // Room
  getRoomStats, getAllRooms, getRoomById, getRoomsByBlock,
  createRoom, bulkCreateRooms,
  updateRoom, updateRoomStatus, deleteRoom,
} from "./hostel.controller.js"
import { validate } from "../../middleware/validate.middleware.js"
import {
  createBlockSchema, updateBlockSchema, blockFiltersSchema,
  createRoomSchema, updateRoomSchema, updateRoomStatusSchema,
  roomFiltersSchema, idParamSchema, blockIdParamSchema,
  bulkCreateRoomsSchema,
} from "./hostel.validation.js"

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK ROUTES  /blocks
// ─────────────────────────────────────────────────────────────────────────────
export const blockRouter = Router()

// Static — must come before /:id
blockRouter.get("/stats",    getBlockStats)
blockRouter.get("/overview", getBlocksOverview)

// Collection
blockRouter.get("/",  validate(blockFiltersSchema), getAllBlocks)
blockRouter.post("/", validate(createBlockSchema),  createBlock)

// Single resource
blockRouter.get   ("/:id",         validate(idParamSchema),    getBlockById)
blockRouter.get   ("/:id/summary", validate(idParamSchema),    getBlockSummary)
blockRouter.patch ("/:id",         validate(updateBlockSchema), updateBlock)
blockRouter.delete("/:id",         validate(idParamSchema),    deleteBlock)

// Rooms nested under a block
blockRouter.get ("/:blockId/rooms",      validate(blockIdParamSchema), getRoomsByBlock)
blockRouter.post("/:blockId/rooms/bulk", validate(bulkCreateRoomsSchema), bulkCreateRooms)

// ─────────────────────────────────────────────────────────────────────────────
// ROOM ROUTES  /rooms
// ─────────────────────────────────────────────────────────────────────────────
export const roomRouter = Router()

// Static — must come before /:id
roomRouter.get("/stats", getRoomStats)

// Collection
roomRouter.get("/",  validate(roomFiltersSchema), getAllRooms)
roomRouter.post("/", validate(createRoomSchema),  createRoom)

// Single resource
roomRouter.get   ("/:id",        validate(idParamSchema),         getRoomById)
roomRouter.patch ("/:id",        validate(updateRoomSchema),      updateRoom)
roomRouter.patch ("/:id/status", validate(updateRoomStatusSchema),updateRoomStatus)
roomRouter.delete("/:id",        validate(idParamSchema),         deleteRoom)