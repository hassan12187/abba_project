import { Router, Request, Response, NextFunction } from "express"
import multer         from "multer"
import path           from "path"
import { StudentApplicationService } from "./studentapplication.services.js"
import { validate }   from "../../middleware/validate.middleware.js"
import { createApplicationSchema } from "./validation.js"
import { Notify }     from "../notifications/notification.services.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/applications"),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e5)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits:     { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`File type ${file.mimetype} is not allowed.`))
  },
})

// ─── Inject file paths into req.body before Zod validation ───────────────────
function injectFilePaths(req: Request, _res: Response, next: NextFunction) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined
  if (files?.student_image?.[0]) {
    req.body.student_image = `uploads/applications/${files.student_image[0].filename}`
  }
  if (files?.cnic_image?.[0]) {
    req.body.cnic_image = `uploads/applications/${files.cnic_image[0].filename}`
  }
  next()
}

export const publicApplicationRouter = Router()

publicApplicationRouter.post(
  "/",
  upload.fields([
    { name: "student_image", maxCount: 1 },
    { name: "cnic_image",    maxCount: 1 },
  ]),
  injectFilePaths,
  validate(createApplicationSchema),
  asyncHandler(async (req, res) => {
    const application = await StudentApplicationService.create(req.body)
    console.log("Im after multer");
    Notify.newApplication({
      studentName:   application.student_name,
      applicationId: application._id.toString(),
    }).catch(console.error)

    res.status(201).json({
      success: true,
      message: "Application submitted successfully. You will be notified once reviewed.",
      data: {
        _id:           application._id,
        student_name:  application.student_name,
        student_email: application.student_email,
        status:        application.status,
      },
    })
  })
)