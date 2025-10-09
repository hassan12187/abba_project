import {model,Schema} from "mongoose";
const hostelBlockSchema=new Schema({
    block_no:{
        type:String
    },
    total_rooms:{
        type:String
    },
    description:{
        type:String
    }
},{timestamps:true});
const HostelBlockModel=model("Block",hostelBlockSchema);
export default HostelBlockModel;