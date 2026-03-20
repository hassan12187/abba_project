import { Router } from "express"
import {
  createMenu,
  getWeeklyMenu,
  getTodayMenu,
  getMenuCoverage,
  getMenuByDay,
  getMenuById,
  updateMenu,
  updateMealItems,
  updateMealTiming,
  bulkUpsertMenus,
  deleteAllMenus,
  deleteMenu,
} from "./messmenu.controller.js"
import { validate } from "../../middleware/validate.middleware.js"
import {
  createMenuSchema,
  updateMenuSchema,
  updateMealItemsSchema,
  updateMealTimingSchema,
  dayParamSchema,
  idParamSchema,
  bulkUpsertSchema,
} from "./messmenu.validation.js"

const router = Router()

// ─── Static routes (must come before /:id) ────────────────────────────────────

// GET  /menus/today                     — today's menu + active meal
router.get("/today", getTodayMenu)

// GET  /menus/coverage                  — which days are configured
router.get("/coverage", getMenuCoverage)

// GET  /menus/day/:day                  — menu by day name e.g. /day/Monday
router.get("/day/:day", validate(dayParamSchema), getMenuByDay)

// POST /menus/bulk                      — seed / replace entire week
router.post("/bulk", validate(bulkUpsertSchema), bulkUpsertMenus)

// DELETE /menus/all                     — wipe all menus (?confirm=true required)
router.delete("/all", deleteAllMenus)

// ─── Collection ───────────────────────────────────────────────────────────────

// GET  /menus                           — all 7 days Mon → Sun
router.get("/", getWeeklyMenu)

// POST /menus                           — create one day's menu
router.post("/", validate(createMenuSchema), createMenu)

// ─── Single resource ──────────────────────────────────────────────────────────

// GET    /menus/:id
router.get("/:id", validate(idParamSchema), getMenuById)

// PATCH  /menus/:id                     — update meals (items + timing)
router.patch("/:id", validate(updateMenuSchema), updateMenu)

// PATCH  /menus/:id/:mealType/items     — granular item add/remove
router.patch(
  "/:id/:mealType/items",
  validate(updateMealItemsSchema),
  updateMealItems
)

// PATCH  /menus/:id/:mealType/timing    — update serving time only
router.patch(
  "/:id/:mealType/timing",
  validate(updateMealTimingSchema),
  updateMealTiming
)

// DELETE /menus/:id                     — delete one day
router.delete("/:id", validate(idParamSchema), deleteMenu)

export default router