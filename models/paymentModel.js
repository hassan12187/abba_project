import {Schema,model} from "mongoose";
const paymentSchema=new Schema({
student_registration_no:{
    type:String
},
student_id:{
    type:Schema.Types.ObjectId,
    ref:"student_application"
},
voucher_id:{
    type:Schema.Types.ObjectId,
    ref:"FeeVoucher"
},
amount_paid:{
    type:Number,
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
date:{
    type:Date,
    default:Date.now,
    immutable:true
}
},{timestamps:true});
const paymentModel=model("payment",paymentSchema);
export default paymentModel;