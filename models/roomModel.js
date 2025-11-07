import {Schema,model} from "mongoose";

const roomSchema=new Schema({
    room_no:{
        type:String
    },
    type:{
        type:String,
        enum:['Single Seater', 'Double Seater', 'Triple Seater'],
        required:true
    },
    fees:{
        type:Number,
        required:true
    },  
    capacity:{
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
roomSchema.virtual("available_beds").get(function(){
    return this.total_beds-this.occupants.length;
});
const roomModel=model("room",roomSchema);
export default roomModel;