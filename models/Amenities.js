import {Schema,model} from "mongoose";

const amenitySchema=new Schema({
    name:{
        type:String,
        required:true,
        enum:[
            "AC",
            "WiFi",
            "Attached Bathroom",
            "Table",
            "Chair",
            "LED TV",
            "Balcony"
        ]
    },
    condition:{
        type: String,
    enum: ["Good", "Needs Repair", "Replaced"],
    default: "Good"
    },
    room:{
        type:Schema.Types.ObjectId,
        required:true
    }
});
const AmenityModel=model("amenity",amenitySchema);
export default AmenityModel;