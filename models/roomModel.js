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
    floor:{
        type:Number,
        required:true
    },
    block_id:{
        type:Schema.Types.ObjectId,
        ref:"Block",
        required:true
    },
    occupants:[
        {
            type:Schema.Types.ObjectId,
            ref:"student_application"
        }
    ],
    amenities:[
        {
            type:Schema.Types.ObjectId,
            ref:"amenity"
        }
    ],
    maintenance_record:[
        {
            type:Schema.Types.ObjectId,
            ref:"maintenance"
        }
    ],
    status:{
        type:String,
        enum:["available","occupied","maintenance"],
        default:"available"
    }
});
const roomModel=model("room",roomSchema);
export default roomModel;