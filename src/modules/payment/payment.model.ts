import { Schema, model } from "mongoose"

const paymentSchema = new Schema(
  {
    student: {
      type:     Schema.Types.ObjectId,
      ref:      "student_application",
      required: [true, "Student reference is required"],
      // ❌ REMOVED unique:true — a student CAN have multiple payments
      // unique:true here would crash on the second payment for the same student
    },
    invoices: [
      {
        invoiceId: {
          type:     Schema.Types.ObjectId,
          ref:      "FeeInvoice",
          required: true,
        },
        amountApplied: {
          type:     Number,
          required: true,
          min:      [0.01, "amountApplied must be greater than 0"],
        },
      },
    ],
    totalAmount: {
      type:     Number,
      required: [true, "totalAmount is required"],
      min:      [0.01, "totalAmount must be greater than 0"],
    },
    paymentMethod: {
      type:     String,
      enum:     ["Cash", "Bank Transfer", "Online", "Cheque"],
      required: [true, "paymentMethod is required"],
    },
    paymentStatus: {
      type:    String,
      enum:    ["successful", "pending", "failed"],  // fixed typo: "successfull" → "successful"
      default: "successful",
    },
    paymentDate: {
      type:      Date,
      default:   Date.now,
      immutable: true,
    },
    transactionId: {
      type:    String,
      trim:    true,
      sparse:  true,   // allows multiple nulls while still being unique when set
      unique:  true,
    },
    note: {
      type:    String,
      trim:    true,
      maxlength: 500,
    },
  },
  { timestamps: true }
)

// ── Pre-save: auto-compute totalAmount from invoice allocations ────────────────
paymentSchema.pre("save", function (next) {
  if (this.invoices && this.invoices.length > 0) {
    const allocated = this.invoices.reduce(
      (acc, item) => acc + item.amountApplied, 0
    )
    this.totalAmount = Math.round(allocated * 100) / 100   // round to 2dp
  }
  next()
})

// ── Indexes for common query patterns ─────────────────────────────────────────
paymentSchema.index({ student:     1 })
paymentSchema.index({ paymentDate: -1 })
paymentSchema.index({ paymentStatus: 1 })
paymentSchema.index({ "invoices.invoiceId": 1 })

const Payment = model("payment", paymentSchema)
export default Payment