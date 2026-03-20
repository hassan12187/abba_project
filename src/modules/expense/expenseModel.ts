import { Schema, model } from "mongoose"

export type ExpenseCategory =
  | "Salary"
  | "Utilities"
  | "Maintenance"
  | "Food"
  | "Rent"
  | "Equipment"
  | "Miscellaneous"

const expenseSchema = new Schema(
  {
    description: {
      type:     String,
      required: [true, "Description is required"],
      trim:     true,
      maxlength: 500,
    },
    amount: {
      type:     Number,
      required: [true, "Amount is required"],
      min:      [0, "Amount cannot be negative"],
    },
    category: {
      type:    String,
      enum:    ["Salary","Utilities","Maintenance","Food","Rent","Equipment","Miscellaneous"],
      default: "Miscellaneous",
      required: true,
    },
    date: {
      type:     Date,
      required: [true, "Date is required"],
      default:  Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // recordedBy: {
    //   type: Schema.Types.ObjectId,
    //   ref:  "User",
    // },
  },
  { timestamps: true }
)

// Index for fast date-range queries
expenseSchema.index({ date: -1 })
expenseSchema.index({ category: 1, date: -1 })

const ExpenseModel = model("expense", expenseSchema)
export default ExpenseModel