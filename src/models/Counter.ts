import {Schema,model} from "mongoose";
const counterSchema=new Schema({
    id:{type:String,required:true,unique:true},
    seq:{type:Number,default:0}
});
const Counter = model("Counter",counterSchema);
export default Counter;