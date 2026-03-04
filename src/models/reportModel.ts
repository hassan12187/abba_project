import {Schema,model} from "mongoose";
const reportSchema = new Schema({
    reportDate:{
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
    net_profit:{
        type:Number,
        default:0
    },
    total_students:{
        type:Number,
        default:0
    },
    expense_breakdown:[{
        category: { type: String, required: true }, // e.g., "Salary", "Utilities", "Rent"
        amount: { type: Number, required: true, default: 0 }
    }]
},{
    timestamps:true
});


const Report = model("report",reportSchema);
export default Report;