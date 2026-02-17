import {Schema,model} from "mongoose";
const paymentSchema=new Schema({
student:{
    type:Schema.Types.ObjectId,
    ref:"student_application",
    required:true
},
invoices:[{
    invoiceId:{
        type:Schema.Types.ObjectId,
        ref:"FeeInvoice",
        required:true
    },
    amountApplied:{
        type:Number,
        required:true
    }
}],
totalAmount:{
    type:Number,
},
paymentMethod:{
    type:String,
    enum:["cash","online"]
},
paymentStatus:{
    type:String,
    enum:["successfull","pending"]
},
paymentDate:{type:Date,default:Date.now,immutable:true},
transactionId:{type:String},
},{timestamps:true});

paymentSchema.pre("save",function(next){
    if(this.invoices && this.invoices.length>0){
        const allocated = this.invoices.reduce((acc,item)=>acc + item.amountApplied,0);
        // console.log(allocated);
        // if(allocated !== this.totalAmount){
        //     return next(new Error('Total payment amount must match sum of invoice allocations'));
        // };
        this.totalAmount=allocated;
    }
    next();
});

const Payment=model("payment",paymentSchema);
export default Payment;