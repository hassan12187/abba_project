import MessMenu from "./MessMenu.js"
import redis     from "../../services/Redis.js"
import {
  IMessMenu, IMeal, DayOfWeek, MealType,
  CreateMenuDTO, UpdateMenuDTO, UpdateMealItemsDTO, UpdateMealTimingDTO,
  BulkUpsertDTO, TodayMenuResponse, WeeklyMenuResponse,
  DAYS_OF_WEEK, MEAL_TYPES,
} from "./types.js"
import { HttpError } from "../../utils/errors.js"

// ─── Cache keys & TTLs ────────────────────────────────────────────────────────
// All keys live under the "menu:" namespace so a single invalidateAll() call
// can wipe them with one SCAN pass.
const CACHE = {
  weekly:    "menu:weekly",
  today:     "menu:today",
  coverage:  "menu:coverage",
  day:  (d: string) => `menu:day:${d}`,
  byId: (id: string) => `menu:id:${id}`,
}

const TTL = {
  weekly:   60 * 60,       // 1 hr  — weekly layout rarely changes
  today:    10 * 60,       // 10 min — currentMeal field must stay fresh
  coverage: 60 * 60,       // 1 hr
  day:      60 * 60,       // 1 hr
  byId:     30 * 60,       // 30 min
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null   // Redis failure is never fatal — fall through to DB
  }
}

async function setCache(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl)
  } catch {
    // Swallow — a write failure doesn't break the response
  }
}

/** Deletes every key that starts with "menu:" — called after any write. */
async function invalidateAll(): Promise<void> {
  try {
    let cursor = "0"
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", "menu:*", "COUNT", 100)
      cursor = next
      if (keys.length) await redis.del(...keys)
    } while (cursor !== "0")
  } catch {
    // Cache invalidation failure should never crash a write operation
  }
}

// ─── Pure helpers (unchanged) ─────────────────────────────────────────────────

const DEFAULT_TIMINGS: Record<MealType, { startTime: string; endTime: string }> = {
  breakfast: { startTime: "07:30 AM", endTime: "09:00 AM" },
  lunch:     { startTime: "01:00 PM", endTime: "02:30 PM" },
  dinner:    { startTime: "08:00 PM", endTime: "09:30 PM" },
}

function getCurrentDay(timezone = "Asia/Karachi"): DayOfWeek {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone })
    .format(new Date()) as DayOfWeek
}

function toMinutes(time: string): number {
  const [hhmm, period] = time.split(" ")
  let [h, m] = hhmm.split(":").map(Number)
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h  = 0
  return h * 60 + m
}

function getActiveMeal(menu: IMessMenu, timezone = "Asia/Karachi"): MealType | "no active meal" {
  const timeStr = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: timezone,
  }).format(new Date())
  const now = toMinutes(timeStr)
  for (const meal of MEAL_TYPES) {
    if (now >= toMinutes(menu[meal].startTime) && now <= toMinutes(menu[meal].endTime))
      return meal
  }
  return "no active meal"
}

function buildMeal(dto?: Partial<IMeal>, type?: MealType): IMeal {
  const def = type ? DEFAULT_TIMINGS[type] : { startTime: "", endTime: "" }
  return {
    items:     dto?.items     ?? [],
    startTime: dto?.startTime ?? def.startTime,
    endTime:   dto?.endTime   ?? def.endTime,
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const MessMenuService = {

  // ── READ ────────────────────────────────────────────────────────────────────

  /**
   * Weekly menu — cached for 1 hour.
   * Cache is invalidated on every write (create, update, delete, bulk).
   */
  async getWeeklyMenu(): Promise<WeeklyMenuResponse> {
    const cached = await getCache<WeeklyMenuResponse>(CACHE.weekly)
    if (cached) return cached

    const menus = await MessMenu.find().lean()
    const byDay = Object.fromEntries(menus.map((m) => [m.dayOfWeek, m]))
    const result = DAYS_OF_WEEK.map((d) => byDay[d]).filter(Boolean) as IMessMenu[]

    await setCache(CACHE.weekly, result, TTL.weekly)
    return result
  },

  /**
   * Today's menu with active meal — cached for 10 min so currentMeal stays fresh.
   */
  async getTodayMenu(timezone?: string): Promise<TodayMenuResponse> {
    const day    = getCurrentDay(timezone)
    const cacheKey = `${CACHE.today}:${day}`

    const cached = await getCache<TodayMenuResponse>(cacheKey)
    if (cached) {
      // Recompute currentMeal live — it changes every ~90 min and must not be stale
      return { ...cached, currentMeal: getActiveMeal(cached as unknown as IMessMenu, timezone) }
    }

    const menu = await MessMenu.findOne({ dayOfWeek: day }).lean()
    if (!menu) throw HttpError.notFound(`No menu has been set for '${day}' yet.`)

    const result: TodayMenuResponse = {
      dayOfWeek:   menu.dayOfWeek as DayOfWeek,
      breakfast:   menu.breakfast as IMeal,
      lunch:       menu.lunch     as IMeal,
      dinner:      menu.dinner    as IMeal,
      currentMeal: getActiveMeal(menu as IMessMenu, timezone),
    }

    await setCache(cacheKey, result, TTL.today)
    return result
  },

  /**
   * Single day by name — cached for 1 hour.
   */
  async getByDay(day: DayOfWeek): Promise<IMessMenu> {
    const cached = await getCache<IMessMenu>(CACHE.day(day))
    if (cached) return cached

    const menu = await MessMenu.findOne({ dayOfWeek: day }).lean()
    if (!menu) throw HttpError.notFound(`No menu found for '${day}'.`)

    await setCache(CACHE.day(day), menu, TTL.day)
    return menu as IMessMenu
  },

  /**
   * Single menu by ID — cached for 30 min.
   */
  async getById(id: string): Promise<IMessMenu> {
    const cached = await getCache<IMessMenu>(CACHE.byId(id))
    if (cached) return cached

    const menu = await MessMenu.findById(id).lean()
    if (!menu) throw HttpError.notFound(`Menu with id '${id}' not found.`)

    await setCache(CACHE.byId(id), menu, TTL.byId)
    return menu as IMessMenu
  },

  /**
   * Coverage — cached for 1 hour.
   */
  async getMenuCoverage() {
    const cached = await getCache<{ configured: DayOfWeek[]; missing: DayOfWeek[]; isWeekComplete: boolean }>(CACHE.coverage)
    if (cached) return cached

    const menus      = await MessMenu.find().select("dayOfWeek").lean()
    const configured = menus.map((m) => m.dayOfWeek) as DayOfWeek[]
    const missing    = DAYS_OF_WEEK.filter((d) => !configured.includes(d))
    const result     = { configured, missing, isWeekComplete: missing.length === 0 }

    await setCache(CACHE.coverage, result, TTL.coverage)
    return result
  },

  // ── WRITE (all invalidate the full cache namespace) ─────────────────────────

  async create(dto: CreateMenuDTO): Promise<IMessMenu> {
    const existing = await MessMenu.findOne({ dayOfWeek: dto.dayOfWeek }).lean()
    if (existing) throw HttpError.conflict(`A menu for '${dto.dayOfWeek}' already exists.`)

    const menu = await MessMenu.create({
      dayOfWeek: dto.dayOfWeek,
      breakfast: buildMeal(dto.breakfast, "breakfast"),
      lunch:     buildMeal(dto.lunch,     "lunch"),
      dinner:    buildMeal(dto.dinner,    "dinner"),
    })

    await invalidateAll()
    return menu.toObject() as IMessMenu
  },

  async update(id: string, dto: UpdateMenuDTO): Promise<IMessMenu> {
    const existing = await MessMenu.findById(id)
    if (!existing) throw HttpError.notFound(`Menu with id '${id}' not found.`)

    const updateFields: Record<string, IMeal> = {}
    for (const meal of MEAL_TYPES) {
      if (dto[meal]) {
        updateFields[meal] = {
          items:     dto[meal]!.items     ?? (existing[meal] as IMeal).items,
          startTime: dto[meal]!.startTime ?? (existing[meal] as IMeal).startTime,
          endTime:   dto[meal]!.endTime   ?? (existing[meal] as IMeal).endTime,
        }
      }
    }

    const updated = await MessMenu.findByIdAndUpdate(id, { $set: updateFields }, { new: true, runValidators: true }).lean()

    await invalidateAll()
    return updated as IMessMenu
  },

  async updateMealItems(id: string, mealType: MealType, dto: UpdateMealItemsDTO): Promise<IMessMenu> {
    const menu = await MessMenu.findById(id)
    if (!menu) throw HttpError.notFound(`Menu with id '${id}' not found.`)

    const meal  = menu[mealType] as IMeal
    let items   = [...meal.items]

    if (dto.remove?.length) {
      const removeSet = new Set(dto.remove.map((i) => i.toLowerCase()))
      items = items.filter((item) => !removeSet.has(item.toLowerCase()))
    }
    if (dto.add?.length) {
      const existingLower = new Set(items.map((i) => i.toLowerCase()))
      const newItems      = dto.add.filter((i) => !existingLower.has(i.toLowerCase()))
      if (items.length + newItems.length > 20)
        throw HttpError.unprocessable(`Adding these items would exceed the 20-item limit for ${mealType}.`)
      items.push(...newItems)
    }

    menu[mealType] = { ...meal, items } as any
    await menu.save()

    await invalidateAll()
    return menu.toObject() as IMessMenu
  },

  async updateMealTiming(id: string, mealType: MealType, dto: UpdateMealTimingDTO): Promise<IMessMenu> {
    const menu = await MessMenu.findById(id)
    if (!menu) throw HttpError.notFound(`Menu with id '${id}' not found.`)

    const meal     = menu[mealType] as IMeal
    const newStart = dto.startTime ?? meal.startTime
    const newEnd   = dto.endTime   ?? meal.endTime

    if (toMinutes(newStart) >= toMinutes(newEnd))
      throw HttpError.unprocessable(`startTime must be before endTime for ${mealType}.`)

    menu[mealType] = { ...meal, startTime: newStart, endTime: newEnd } as any
    await menu.save()

    await invalidateAll()
    return menu.toObject() as IMessMenu
  },

  async bulkUpsert(days: BulkUpsertDTO): Promise<{ upsertedCount: number; days: DayOfWeek[] }> {
    const ops = days.map((dto) => ({
      updateOne: {
        filter: { dayOfWeek: dto.dayOfWeek },
        update: { $set: { breakfast: buildMeal(dto.breakfast, "breakfast"), lunch: buildMeal(dto.lunch, "lunch"), dinner: buildMeal(dto.dinner, "dinner") } },
        upsert: true,
      },
    }))

    const result = await MessMenu.bulkWrite(ops)
    await invalidateAll()

    return { upsertedCount: result.upsertedCount + result.modifiedCount, days: days.map((d) => d.dayOfWeek) }
  },

  async delete(id: string): Promise<void> {
    const result = await MessMenu.findByIdAndDelete(id)
    if (!result) throw HttpError.notFound(`Menu with id '${id}' not found.`)
    await invalidateAll()
  },

  async deleteAll(): Promise<{ deletedCount: number }> {
    const result = await MessMenu.deleteMany({})
    await invalidateAll()
    return { deletedCount: result.deletedCount }
  },
}