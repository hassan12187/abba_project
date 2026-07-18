import { Document, Model, Types } from "mongoose";
import {Schema,model} from "mongoose";

interface LineItems {
description:string
amount:number
paid:number
};

interface IFeeInvoice extends Document{
  student_id:Types.ObjectId
  room_id:Types.ObjectId
  invoiceNumber:string
  lineItems:LineItems[]
  issueDate:Date
  totalPaid:number
  totalAmount:number
  payments:[Types.ObjectId]
  billingMonth:string
  generatedBy:string
  status:string
  isLocked:boolean
  dueDate:Date
  balanceDue:number
};

type IFeeInvoiceModel = Model<IFeeInvoice,{},{}>;

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
    paid:{
      type:Number,
      default:0
    }
  },
  { _id: false }
);

const feeInvoiceSchema=new Schema<IFeeInvoice,IFeeInvoiceModel,{}>({
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
            ref:'payment'
        }
    ],
    billingMonth: {
  type: String, // "2026-01"
  required: true,
  index: true
},
generatedBy: {
  type: String,
  enum: ["AUTO", "MANUAL"],
  default: "AUTO"
},
    status:{
        type:String,
        enum:['pending', 'paid', 'partially paid', 'overdue', 'cancelled'],
        default:"pending"
    },
    isLocked: {
  type: Boolean,
  default: false
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

feeInvoiceSchema.pre("save",function(next){
  if(this.totalPaid >= this.totalAmount){
    this.status="paid";
  }else if(this.totalPaid>0){
    this.status="partially paid"
  };
  next();
});

const FeeInvoiceModel=model<IFeeInvoice,IFeeInvoiceModel>("FeeInvoice",feeInvoiceSchema);
export default FeeInvoiceModel;