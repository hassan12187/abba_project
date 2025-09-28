import {model,Schema} from "mongoose";
const expenseSchema=new Schema({
    expense_type:{
        type:String,
        enum:["salary","asset","normal expense"],
        default:"salary"
    },
    description:{
        type:String
    },
    amount:{
        type:Number,
        default:0
    },
    date:{
        type:Date,
        default:Date.now,
        immutable:true
    }
});
const expenseModel=model("expense",expenseSchema);
export default expenseModel;