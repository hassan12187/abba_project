import { Request, Response, NextFunction } from "express"
import { MessMenuService } from "./messmenu.services.js"

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /menus
 * Create a menu for one day of the week.
 */
export const createMenu = asyncHandler(async (req, res) => {
  const menu = await MessMenuService.create(req.body)
  res.status(201).json({
    success: true,
    message: `Menu for '${menu.dayOfWeek}' created successfully.`,
    data: menu,
  })
})

/**
 * GET /menus
 * All 7 days ordered Monday → Sunday.
 */
export const getWeeklyMenu = asyncHandler(async (_req, res) => {
  const menus = await MessMenuService.getWeeklyMenu()
  res.status(200).json({ success: true, data: menus })
})

/**
 * GET /menus/today
 * Today's menu with active meal highlighted.
 */
export const getTodayMenu = asyncHandler(async (req, res) => {
  const timezone = req.query.timezone as string | undefined
  const menu     = await MessMenuService.getTodayMenu(timezone)
  res.status(200).json({ success: true, data: menu })
})

/**
 * GET /menus/coverage
 * Which days have menus configured and which are missing.
 */
export const getMenuCoverage = asyncHandler(async (_req, res) => {
  const coverage = await MessMenuService.getMenuCoverage()
  res.status(200).json({ success: true, data: coverage })
})

/**
 * GET /menus/day/:day
 * Get menu for a specific day by name, e.g. /menus/day/Monday
 */
export const getMenuByDay = asyncHandler(async (req, res) => {
  const menu = await MessMenuService.getByDay(req.params.day as any)
  res.status(200).json({ success: true, data: menu })
})

/**
 * GET /menus/:id
 * Get menu by MongoDB ID.
 */
export const getMenuById = asyncHandler(async (req, res) => {
  const menu = await MessMenuService.getById(req.params.id)
  res.status(200).json({ success: true, data: menu })
})

/**
 * PATCH /menus/:id
 * Update one or more meals (items + timings) for a day.
 */
export const updateMenu = asyncHandler(async (req, res) => {
  const menu = await MessMenuService.update(req.params.id, req.body)
  res.status(200).json({
    success: true,
    message: "Menu updated successfully.",
    data: menu,
  })
})

/**
 * PATCH /menus/:id/:mealType/items
 * Add or remove items from a specific meal.
 */
export const updateMealItems = asyncHandler(async (req, res) => {
  const menu = await MessMenuService.updateMealItems(
    req.params.id,
    req.params.mealType as any,
    req.body
  )
  res.status(200).json({
    success: true,
    message: `${req.params.mealType} items updated.`,
    data: menu,
  })
})

/**
 * PATCH /menus/:id/:mealType/timing
 * Update the serving times for a specific meal.
 */
export const updateMealTiming = asyncHandler(async (req, res) => {
  const menu = await MessMenuService.updateMealTiming(
    req.params.id,
    req.params.mealType as any,
    req.body
  )
  res.status(200).json({
    success: true,
    message: `${req.params.mealType} timing updated.`,
    data: menu,
  })
})

/**
 * POST /menus/bulk
 * Seed or replace the entire week in one shot.
 */
export const bulkUpsertMenus = asyncHandler(async (req, res) => {
  const result = await MessMenuService.bulkUpsert(req.body)
  res.status(200).json({
    success: true,
    message: `${result.upsertedCount} day(s) upserted: ${result.days.join(", ")}.`,
    data: result,
  })
})

/**
 * DELETE /menus/all
 * Wipe the entire weekly menu (requires confirmation query param).
 */
export const deleteAllMenus = asyncHandler(async (req, res) => {
  if (req.query.confirm !== "true") {
    res.status(400).json({
      success: false,
      message: "Add ?confirm=true to confirm deletion of all menus.",
    })
    return
  }
  const result = await MessMenuService.deleteAll()
  res.status(200).json({
    success: true,
    message: `${result.deletedCount} menu(s) deleted.`,
    data: result,
  })
})

/**
 * DELETE /menus/:id
 * Delete a single day's menu.
 */
export const deleteMenu = asyncHandler(async (req, res) => {
  await MessMenuService.delete(req.params.id)
  res.status(200).json({
    success: true,
    message: "Menu deleted successfully.",
  })
})