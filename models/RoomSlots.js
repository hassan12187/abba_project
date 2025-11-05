import {Schema,SchemaTypeOptions,model} from "mongoose";

const roomSlots=new Schema({
    student_id:{
        type:Schema.Types.ObjectId,
        ref:"student_application",
        required:true
    },
    room_id:{
        type:Schema.Types.ObjectId,
        ref:"room",
        required:true
    },
    check_in_date:{
        type:Date,
        default:Date.now
    },
    check_out_date:{
        type:Date,
    },
    status:{
        type:String,
        enum:["active","left","pending"]
    }
},{timestamps:true});
const RoomSlots=model("RoomSlots",roomSlots);
export default RoomSlots;