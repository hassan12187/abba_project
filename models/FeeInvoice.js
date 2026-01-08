import {Schema,model} from "mongoose";

const lineItemSchema = new Schema(
  {
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const feeInvoiceSchema=new Schema({
    student_id:{
        type:Schema.Types.ObjectId,
        ref:"student_application"
    },
    room_id:{
        type:Schema.Types.ObjectId,
        ref:"room"
    },
    invoiceNumber:{
        type:String,
        required:true,
        unique:true
    },
   lineItems:[lineItemSchema],
    issueDate:{
        type:Date,
        default:Date.now
    },
    totalPaid:{
        type:Number,
        default:0
    },
    totalAmount:{
        type:Number,
        default:0
    },
    payments:[
        {
            type:Schema.Types.ObjectId,
            ref:'Payment'
        }
    ],
    billingMonth: {
  type: String, // "2026-01"
  required: true,
  index: true
},
billingYear: {
  type: Number,
  required: true
},
generatedBy: {
  type: String,
  enum: ["AUTO", "MANUAL"],
  default: "AUTO"
},
    status:{
        type:String,
        enum:['Pending', 'Paid', 'PartiallyPaid', 'Overdue', 'Cancelled'],
        default:"Pending"
    },
    dueDate:{
        type:Date,
        required:true
    }
},{
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  });
feeInvoiceSchema.index(
  { student_id: 1, billingMonth: 1 },
  { unique: true }
);

feeInvoiceSchema.virtual('balanceDue').get(function (){
    return this.totalAmount - this.totalPaid;
});

const FeeInvoiceModel=model("FeeInvoice",feeInvoiceSchema);
export default FeeInvoiceModel;