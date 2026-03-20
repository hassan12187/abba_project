// ─── Enums ────────────────────────────────────────────────────────────────────
export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday"

export type MealType = "breakfast" | "lunch" | "dinner"

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
]

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"]

// ─── Sub-document ─────────────────────────────────────────────────────────────
export interface IMeal {
  items: string[]
  startTime: string
  endTime: string
}

// ─── Core document ────────────────────────────────────────────────────────────
export interface IMessMenu {
  _id: string
  dayOfWeek: DayOfWeek
  breakfast: IMeal
  lunch: IMeal
  dinner: IMeal
  createdAt: Date
  updatedAt: Date
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** Full meal payload used inside create/update DTOs */
export interface MealDTO {
  items?: string[]
  startTime?: string
  endTime?: string
}

/** Create one day's menu */
export interface CreateMenuDTO {
  dayOfWeek: DayOfWeek
  breakfast?: MealDTO
  lunch?: MealDTO
  dinner?: MealDTO
}

/** Update one day's menu — all fields optional */
export interface UpdateMenuDTO {
  breakfast?: MealDTO
  lunch?: MealDTO
  dinner?: MealDTO
}

/** Add / remove items from a single meal */
export interface UpdateMealItemsDTO {
  add?: string[]
  remove?: string[]
}

/** Update only the timing of a meal */
export interface UpdateMealTimingDTO {
  startTime?: string
  endTime?: string
}

/** Seed / replace the entire week in one request */
export type BulkUpsertDTO = CreateMenuDTO[]

// ─── Response helpers ─────────────────────────────────────────────────────────

/** What "today's menu" looks like */
export interface TodayMenuResponse {
  dayOfWeek: DayOfWeek
  breakfast: IMeal
  lunch: IMeal
  dinner: IMeal
  currentMeal: MealType | "no active meal"
}

/** Weekly view — ordered Mon → Sun */
export type WeeklyMenuResponse = IMessMenu[]