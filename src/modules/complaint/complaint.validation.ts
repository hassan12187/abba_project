import { z } from "zod"
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
} from "./complaint.model.js"

const objectId   = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId")
const isoDate    = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")

const priorityEnum = z.enum(COMPLAINT_PRIORITIES)
const categoryEnum = z.enum(COMPLAINT_CATEGORIES)
const statusEnum   = z.enum(COMPLAINT_STATUSES)

// ─── Status transition guard ──────────────────────────────────────────────────
// Prevents illegal jumps like Resolved → Pending or Rejected → In Progress
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Pending:     ["In Progress", "Rejected"],
  "In Progress":["Resolved",   "Rejected", "Pending"],
  Resolved:    [],                              // terminal — no transitions out
  Rejected:    ["Pending"],                     // can be re-opened
}

// ─── Create ───────────────────────────────────────────────────────────────────
export const createComplaintSchema = z.object({
  body: z.object({
    student_id:  objectId,
    room_id:     objectId,

    title: z
      .string({ required_error: "title is required" })
      .min(5,   "title must be at least 5 characters")
      .max(150, "title must be at most 150 characters")
      .trim(),

    description: z
      .string({ required_error: "description is required" })
      .min(10,   "description must be at least 10 characters")
      .max(2000, "description must be at most 2000 characters")
      .trim(),

    priority: priorityEnum.optional(),
    category: categoryEnum.optional(),
  }),
})

// ─── Update (title / description / priority / category / assignment) ──────────
export const updateComplaintSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      title:           z.string().min(5).max(150).trim().optional(),
      description:     z.string().min(10).max(2000).trim().optional(),
      priority:        priorityEnum.optional(),
      category:        categoryEnum.optional(),
      assigned_to:     objectId.nullable().optional(),
      admin_comments:  z.string().max(1000).trim().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "At least one field must be provided",
    }),
})

// ─── Status transition ────────────────────────────────────────────────────────
export const updateStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status:         statusEnum,
    admin_comments: z.string().max(1000).trim().optional(),
    note:           z.string().max(500).trim().optional(),
    // current_status is injected by the controller after fetching the doc —
    // the refine below runs only when it is supplied (i.e. always in production)
    current_status: statusEnum.optional(),
  }).refine(
    (d) => {
      if (!d.current_status) return true   // skip check if not injected yet
      const allowed = ALLOWED_TRANSITIONS[d.current_status] ?? []
      return allowed.includes(d.status)
    },
    (d) => ({
      message: `Cannot transition from "${d.current_status}" to "${d.status}". ` +
               `Allowed: ${(ALLOWED_TRANSITIONS[d.current_status ?? ""] ?? []).join(", ") || "none"}.`,
    })
  ),
})

// ─── Filters ──────────────────────────────────────────────────────────────────
export const complaintFiltersSchema = z.object({
  query: z
    .object({
      status:    z.enum([...COMPLAINT_STATUSES, "All"] as [string, ...string[]]).optional(),
      priority:  priorityEnum.optional(),
      category:  categoryEnum.optional(),
      search:    z.string().max(200).optional(),
      from:      isoDate.optional(),
      to:        isoDate.optional(),
      page:      z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
      limit:     z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("15"),
      sortBy:    z.enum(["createdAt", "updatedAt", "priority"]).optional().default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    })
    .refine(
      (d) => !(d.from && d.to && new Date(d.from) > new Date(d.to)),
      { message: "from must be before to" }
    ),
})

// ─── ID param ─────────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})