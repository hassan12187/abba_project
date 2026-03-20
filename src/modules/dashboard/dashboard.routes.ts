import { Request, Response, NextFunction } from "express"
import { Router }           from "express"
import { DashboardService } from "./dashboard.services.js"

// ─── Controller ───────────────────────────────────────────────────────────────
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

export const getDashboard = asyncHandler(async (_req, res) => {
  const data = await DashboardService.getHomeDashboard()
  res.status(200).json({ success: true, data })
})

// ─── Router ───────────────────────────────────────────────────────────────────
// Mount as:  app.use("/api/admin/report", dashboardRouter)
// Endpoint:  GET /api/admin/report/home-dashboard

// export const dashboardRouter = Router()
// dashboardRouter.get("/", getDashboard)