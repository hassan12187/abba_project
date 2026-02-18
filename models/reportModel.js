import {Schema,model} from "mongoose";
const reportSchema = new Schema({
    date:{
        type:Date,
        immutable:true,
        required:true
    },
    total_expenses:{
        type:Number,
        default:0
    },
    total_payments:{
        type:Number,
        default:0
    },
    net_balance:{
        type:Number,
        default:0
    }
    // total_students:{
    //     type:Number,
    //     default:0
    // }
},{
    timestamps:true
});

reportSchema.index({date:1},{unique:true});

const Report = model("report",reportSchema);
export default Report;