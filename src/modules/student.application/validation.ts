import { z } from "zod"

// ─── Primitives ───────────────────────────────────────────────────────────────
const objectId    = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId")
const phoneNo     = z.string().regex(/^[0-9+\-\s()]{7,20}$/, "Invalid phone number format")
const cnicSchema  = z.string().regex(/^\d{5}-\d{7}-\d$/, "CNIC must follow XXXXX-XXXXXXX-X format")
const genderEnum  = z.enum(["male", "female"])
const statusEnum  = z.enum(["accepted", "pending", "rejected", "approved"])
const dobSchema   = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD")
  .refine((d) => {
    const parsed = new Date(d)
    const now    = new Date()
    const age    = now.getFullYear() - parsed.getFullYear()
    return !isNaN(parsed.getTime()) && age >= 14 && age <= 40
  }, "Date of birth must correspond to an age between 14 and 40")

// ─── Create ───────────────────────────────────────────────────────────────────
export const createApplicationSchema = z.object({
  body: z.object({
    student_name: z
      .string({ required_error: "Student name is required" })
      .min(3, "Must be at least 3 characters")
      .max(30, "Must be at most 30 characters")
      .trim(),

    student_email: z
      .string({ required_error: "Email is required" })
      .email("Must be a valid email address")
      .toLowerCase()
      .trim(),

    father_name: z
      .string({ required_error: "Father name is required" })
      .min(3, "Must be at least 3 characters")
      .max(30, "Must be at most 30 characters")
      .trim(),

    student_cellphone: phoneNo.optional(),
    father_cellphone:  phoneNo.optional(),
    guardian_cellphone:phoneNo.optional(),
    active_whatsapp_no:phoneNo.optional(),
    student_reg_no:    z.string().trim().optional(),

    guardian_name: z
      .string()
      .min(3, "Must be at least 3 characters")
      .max(30, "Must be at most 30 characters")
      .trim()
      .optional(),

    cnic_no:          cnicSchema.optional(),
    postal_address:   z.string().max(200).trim().optional(),
    permanent_address:z.string().max(200).trim().optional(),
    city:             z.string().max(50).trim().optional(),
    province:         z.string().max(50).trim().optional(),
    date_of_birth:    dobSchema.optional(),
    academic_year:    z.string().regex(/^\d{4}-\d{4}$/, "Academic year must be YYYY-YYYY").optional(),
    gender:           genderEnum.optional(),
  }),
})

// ─── Update (admin) ───────────────────────────────────────────────────────────
export const updateApplicationSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      student_name:      z.string().min(3).max(30).trim().optional(),
      student_email:     z.string().email().toLowerCase().trim().optional(),
      student_roll_no:   z.number().int().positive().optional(),
      father_name:       z.string().min(3).max(30).trim().optional(),
      student_cellphone: phoneNo.optional(),
      father_cellphone:  phoneNo.optional(),
      guardian_name:     z.string().min(3).max(30).trim().optional(),
      guardian_cellphone:phoneNo.optional(),
      cnic_no:           cnicSchema.optional(),
      active_whatsapp_no:phoneNo.optional(),
      postal_address:    z.string().max(200).trim().optional(),
      permanent_address: z.string().max(200).trim().optional(),
      city:              z.string().max(50).trim().optional(),
      province:          z.string().max(50).trim().optional(),
      date_of_birth:     dobSchema.optional(),
      academic_year:     z.string().regex(/^\d{4}-\d{4}$/).optional(),
      gender:            genderEnum.optional(),
      student_reg_no:    z.string().trim().optional(),
      hostelJoinDate:    z.string().datetime().transform(v => new Date(v)).optional(),
      hostelLeaveDate:   z.string().datetime().transform(v => new Date(v)).optional(),
      isActive:          z.boolean().optional(),
      room_id:           objectId.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "At least one field must be provided",
    }),
})

// ─── Status transition ────────────────────────────────────────────────────────
export const updateStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: statusEnum,
    reason: z.string().min(3).max(500).optional(),
  }),
})

// ─── Toggle access (mess / isActive) ─────────────────────────────────────────
export const toggleAccessSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      messEnabled: z.boolean().optional(),
      isActive:    z.boolean().optional(),
    })
    .refine((d) => d.messEnabled !== undefined || d.isActive !== undefined, {
      message: "Provide at least one of: messEnabled, isActive",
    }),
})

// ─── Assign room ──────────────────────────────────────────────────────────────
export const assignRoomSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    room_id: objectId.nullable(),
  }),
})

// ─── Params (single ID) ───────────────────────────────────────────────────────
export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
})

// ─── Query filters ────────────────────────────────────────────────────────────
export const applicationFiltersSchema = z.object({
  query: z.object({
    status:        statusEnum.optional(),
    gender:        genderEnum.optional(),
    city:          z.string().optional(),
    province:      z.string().optional(),
    academic_year: z.string().optional(),
    messEnabled:   z.enum(["true","false"]).transform(v => v === "true").optional(),
    isActive:      z.enum(["true","false"]).transform(v => v === "true").optional(),
    search:        z.string().max(100).optional(),
    page:          z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    limit:         z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("10"),
    sortBy:        z.enum(["application_submit_date","student_name","createdAt"]).optional().default("createdAt"),
    sortOrder:     z.enum(["asc","desc"]).optional().default("desc"),
  }),
})

// ─── Bulk status update ───────────────────────────────────────────────────────
export const bulkStatusSchema = z.object({
  body: z.object({
    ids:    z.array(objectId).min(1, "Provide at least one id").max(50, "Max 50 ids per request"),
    status: statusEnum,
    reason: z.string().max(500).optional(),
  }),
})