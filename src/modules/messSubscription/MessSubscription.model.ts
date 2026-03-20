import {Schema,model} from "mongoose";

const messSubscriptionSchema=new Schema({
    student:{
        type:Schema.Types.ObjectId,
        ref:"student_application",
        required:true,
        unique:true
    },
    planType:{
        type:String,
        enum:["Monthly","Semester","Pay_Per_Meal"],
        default:"Monthly"
    },
    status:{
        type:String,
        enum:["Active","Cancelled","Suspended"],
        default:"Active"
    },
    monthlyFee:{
        type:Number,
        required:true
    },
    validUntil:{
        type:Date
    }
},{timestamps:true});

export default model("MessSubscription",messSubscriptionSchema);