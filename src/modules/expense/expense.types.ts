// ─── Shared enum ─────────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  "Salary",
  "Utilities",
  "Maintenance",
  "Food",
  "Rent",
  "Equipment",
  "Miscellaneous",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

// ─── Core shape ───────────────────────────────────────────────────────────────
export interface Expense {
  _id:         string
  description: string
  amount:      number
  category:    ExpenseCategory
  date:        string          // ISO string
  note?:       string
  createdAt:   string
  updatedAt:   string
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────
export interface CreateExpenseDTO {
  description: string
  amount:      number
  category:    ExpenseCategory
  date?:       string          // YYYY-MM-DD; defaults to today server-side
  note?:       string
}

export type UpdateExpenseDTO = Partial<CreateExpenseDTO>

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface ExpenseFilters {
  category?: ExpenseCategory | ""
  from?:     string           // YYYY-MM-DD
  to?:       string           // YYYY-MM-DD
  search?:   string           // description search
  page?:     number
  limit?:    number
  sortBy?:   "date" | "amount" | "createdAt"
  sortOrder?:"asc" | "desc"
}

// ─── API response wrappers ────────────────────────────────────────────────────
export interface PaginatedExpensesResponse {
  success:    boolean
  data:       Expense[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
  totalAmount:number          // sum of ALL matching records
}

export interface SingleExpenseResponse {
  success:  boolean
  data:     Expense
  message?: string
}

export interface ExpenseStatsResponse {
  success: boolean
  data: {
    byCategory: Record<ExpenseCategory, { count: number; amount: number }>
    totalAmount: number
    totalCount:  number
    thisMonth:   number
    lastMonth:   number
  }
}