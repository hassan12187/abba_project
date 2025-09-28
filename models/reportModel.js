import {Schema,model} from "mongoose";
const reportSchema = new Schema({
    date:{
        type:Date,
        default:Date.now,
        immutable:true
    },
    total_expenses:{
        type:Number,
        default:0
    },
    total_payments:{
        type:Number,
        default:0
    },
    total_students:{
        type:Number,
        default:0
    }
},{
    timestamps:true
});
const reportModel = model("report",reportSchema);
export default reportModel;