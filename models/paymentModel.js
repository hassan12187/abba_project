import {Schema,model} from "mongoose";
const paymentSchema=new Schema({
student_registration_no:{
    type:String
},
amount:{
    type:Number,
    default:0,
    require:true
},
payment_method:{
    type:String,
    enum:["cash","online"]
},
date:{
    type:Date,
    default:Date.now,
    immutable:true
}
});
const paymentModel=model("payment",paymentSchema);
export default paymentModel;