import { z } from "zod"

// ─── Primitives ───────────────────────────────────────────────────────────────
const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId")

const blockStatusEnum = z.enum(["under construction", "ready", "maintenance"])
const roomTypeEnum    = z.enum(["Single Seater", "Double Seater", "Triple Seater"])
const roomStatusEnum  = z.enum(["available", "occupied", "maintenance"])

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const createBlockSchema = z.object({
  body: z.object({
    block_no: z
      .string({ required_error: "Block number is required" })
      .min(1, "Block number cannot be empty")
      .max(10)
      .trim(),
    total_rooms: z
      .number({ required_error: "total_rooms is required" })
      .int("Must be a whole number")
      .min(1, "Must have at least 1 room")
      .max(500),
    description: z.string().max(500).trim().optional(),
    status:      blockStatusEnum.optional(),
  }),
})

export const updateBlockSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      block_no:    z.string().min(1).max(10).trim().optional(),
      total_rooms: z.number().int().min(1).max(500).optional(),
      description: z.string().max(500).trim().optional(),
      status:      blockStatusEnum.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Provide at least one field to update",
    }),
})

export const blockFiltersSchema = z.object({
  query: z.object({
    status:    blockStatusEnum.optional(),
    search:    z.string().max(100).optional(),
    page:      z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:     z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("10"),
    sortBy:    z.enum(["block_no", "createdAt"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
})

// ─────────────────────────────────────────────────────────────────────────────
// ROOM SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const createRoomSchema = z.object({
  body: z.object({
    room_no:  z
      .string({ required_error: "Room number is required" })
      .min(1)
      .max(10)
      .trim(),
    type:     roomTypeEnum.optional(),
    fees:     z
      .number({ required_error: "Fees are required" })
      .min(0, "Fees cannot be negative")
      .transform((v) => Math.round(v * 100) / 100),
    capacity: z.number().int().min(1).max(20).optional(),
    block_id: objectId,
    status:   roomStatusEnum.optional(),
  }),
})

export const updateRoomSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      room_no:  z.string().min(1).max(10).trim().optional(),
      type:     roomTypeEnum.optional(),
      fees:     z.number().min(0).transform((v) => Math.round(v * 100) / 100).optional(),
      capacity: z.number().int().min(1).max(20).optional(),
      status:   roomStatusEnum.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Provide at least one field to update",
    }),
})

export const updateRoomStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: roomStatusEnum,
    reason: z.string().max(500).optional(),
  }),
})

export const roomFiltersSchema = z.object({
  query: z.object({
    block_id:  objectId.optional(),
    type:      roomTypeEnum.optional(),
    status:    roomStatusEnum.optional(),
    available: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    search:    z.string().max(100).optional(),
    page:      z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:     z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("10"),
    sortBy:    z.enum(["room_no", "fees", "capacity"]).optional().default("room_no"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  }),
})

// ─── Shared ───────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})

export const blockIdParamSchema = z.object({
  params: z.object({ blockId: objectId }),
})

// ─── Bulk create rooms for a block ────────────────────────────────────────────
export const bulkCreateRoomsSchema = z.object({
  params: z.object({ blockId: objectId }),
  body: z.object({
    rooms: z
      .array(
        z.object({
          room_no:  z.string().min(1).max(10).trim(),
          type:     roomTypeEnum.optional(),
          fees:     z.number().min(0).transform((v) => Math.round(v * 100) / 100),
          capacity: z.number().int().min(1).max(20).optional(),
        })
      )
      .min(1, "Provide at least one room")
      .max(100, "Max 100 rooms per request"),
  }),
})