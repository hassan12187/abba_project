import {Schema,model} from "mongoose";
const feeVoucherSchema=new Schema({
    student_id:{
        type:Schema.Types.ObjectId,
        ref:"student_application"
    },
    room_id:{
        type:Schema.Types.ObjectId,
        ref:"room"
    },
    total_room_fee:{
        type:Number
    },
    additional_service_fee:[
        {
            service_name:{type:String},
            fee:{type:Number}
        }
    ],
    voucher_month:{type:Date,immutable:true},
    payment_status:{
        type:String,
        enum:["paid","pending"]
    },
    due_date:{
        type:Date
    }
},{timestamps:true});
const FeeVoucherModel=model("FeeVoucher",feeVoucherSchema);
export default FeeVoucherModel;