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
    room_fee:{
        type:Number
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

feeInvoiceSchema.virtual('balanceDue').get(function (){
    return this.totalAmount - this.totalPaid;
});

const FeeInvoiceModel=model("FeeInvoice",feeInvoiceSchema);
export default FeeInvoiceModel;