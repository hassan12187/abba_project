import {Schema,model} from "mongoose";

const roomSchema=new Schema({
    room_no:{
        type:String
    },
    total_beds:{
        type:Number
    },
    available_beds:{
        type:Number
    },
    status:{
        type:String,
        enum:["available","occupied","maintenance"],
        default:"available"
    }
});
const roomModel=model("room",roomSchema);
export default roomModel;