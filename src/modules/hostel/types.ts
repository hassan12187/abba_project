import { Document, Types } from "mongoose"

// ─── Enums ────────────────────────────────────────────────────────────────────
export type BlockStatus  = "under construction" | "ready" | "maintenance"
export type RoomType     = "Single Seater" | "Double Seater" | "Triple Seater"
export type RoomStatus   = "available" | "occupied" | "maintenance"

// ─── Core documents ───────────────────────────────────────────────────────────
export interface IHostelBlock {
  _id:         Types.ObjectId
  block_no:    string
  total_rooms: number
  description?: string
  status:      BlockStatus
  createdAt:   Date
  updatedAt:   Date
}

export interface IRoom extends Document {
  _id:                Types.ObjectId
  room_no:            string
  type:               RoomType
  fees:               number
  capacity:           number
  block_id:           Types.ObjectId
  occupants:          Types.ObjectId[]
  amenities:          Types.ObjectId[]
  maintenance_record: Types.ObjectId[]
  status:             RoomStatus
  available_beds:     number           // virtual
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateBlockDTO {
  block_no:     string
  total_rooms:  number
  description?: string
  status?:      BlockStatus
}

export interface UpdateBlockDTO {
  block_no?:    string
  total_rooms?: number
  description?: string
  status?:      BlockStatus
}

export interface CreateRoomDTO {
  room_no:   string
  type?:     RoomType
  fees:      number
  capacity?: number
  block_id:  string
  status?:   RoomStatus
}

export interface UpdateRoomDTO {
  room_no?:  string
  type?:     RoomType
  fees?:     number
  capacity?: number
  status?:   RoomStatus
}

export interface UpdateRoomStatusDTO {
  status: RoomStatus
  reason?: string
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface BlockFilters {
  status?:    BlockStatus|undefined
  search?:    string |undefined      // matches block_no or description
  page?:      number |undefined
  limit?:     number|undefined
  sortBy?:    "block_no" | "createdAt"|undefined
  sortOrder?: "asc" | "desc"|undefined
}

export interface RoomFilters {
  block_id?:  string |undefined
  type?:      RoomType|undefined
  status?:    RoomStatus|undefined
  available?: boolean    |undefined // only rooms with available_beds > 0
  search?:    string    |undefined  // matches room_no
  page?:      number|undefined
  limit?:     number|undefined
  sortBy?:    "room_no" | "fees" | "capacity"|undefined
  sortOrder?: "asc" | "desc"|undefined
}

export interface PaginatedResult<T> {
  data:       T[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

// ─── Summary shapes ───────────────────────────────────────────────────────────
export interface BlockSummary extends IHostelBlock {
  room_count:       number
  available_rooms:  number
  occupied_rooms:   number
  total_occupants:  number
}

export interface BlockStats {
  total:              number
  byStatus:           Record<BlockStatus, number>
  totalRooms:         number
  totalOccupants:     number
}