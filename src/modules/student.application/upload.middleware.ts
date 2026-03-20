import multer, { FileFilterCallback } from "multer"
import path from "path"
import fs from "fs"
import { Request } from "express"
import { HttpError } from "../../utils/errors.js"

// ─── Ensure upload dirs exist ─────────────────────────────────────────────────
const UPLOAD_ROOT     = path.join(process.cwd(), "uploads")
const STUDENT_IMG_DIR = path.join(UPLOAD_ROOT, "students")
const CNIC_IMG_DIR    = path.join(UPLOAD_ROOT, "cnic")

for (const dir of [STUDENT_IMG_DIR, CNIC_IMG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── Storage engine ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(_req, file, cb) {
    const dest = file.fieldname === "cnic_image" ? CNIC_IMG_DIR : STUDENT_IMG_DIR
    cb(null, dest)
  },
  filename(_req, file, cb) {
    const ext      = path.extname(file.originalname).toLowerCase()
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`
    cb(null, safeName)
  },
})

// ─── File type guard ──────────────────────────────────────────────────────────
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"]
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new HttpError("Only JPEG, PNG, and WebP images are allowed.", 415) as unknown as null, false)
  }
}

// ─── Multer instance ──────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  5 * 1024 * 1024, // 5 MB per file
    files:     3,               // max: 1 student_image + 2 cnic_image pages
  },
})

/**
 * Use on create and update routes.
 * Fields: student_image (1 file), cnic_image (up to 2 files).
 */
export const uploadApplicationImages = upload.fields([
  { name: "student_image", maxCount: 1 },
  { name: "cnic_image",    maxCount: 2 },
])