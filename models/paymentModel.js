import {Schema,model} from "mongoose";
const paymentSchema=new Schema({
student_registration_no:{
    type:String
},
student:{
    type:Schema.Types.ObjectId,
    ref:"student_application"
},
invoices:[{
    type:Schema.Types.ObjectId,
    ref:"FeeInvoice",
    required:true
}],
amount:{
    type:Number,
    required:true
},
payment_method:{
    type:String,
    enum:["cash","online"]
},
payment_status:{
    type:String,
    enum:["successfull","pending"]
},
payment_date:{type:Date,default:Date.now,immutable:true},
transaction_id:{type:String},
},{timestamps:true});
const paymentModel=model("payment",paymentSchema);
export default paymentModel;