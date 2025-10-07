import {model,Schema} from "mongoose";
const departmentSchema=new Schema({
   department:{
    type:String,
   },
    date:{
        type:Date,
        default:Date.now,
        immutable:true
    }
});
const DepartModel=model("department",departmentSchema);
export default DepartModel;