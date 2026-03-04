import {model,Schema} from "mongoose";
const hostelBlockSchema=new Schema({
    block_no:{
        type:String
    },
    total_rooms:{
        type:Number
    },
    description:{
        type:String
    },
    status:{
        type:String,
        enum:["under construction","ready","maintenance"],
        default:"under construction"
    }
},{timestamps:true});
const HostelBlockModel=model("Block",hostelBlockSchema);
export default HostelBlockModel;