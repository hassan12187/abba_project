import {Schema,model} from "mongoose";

const messMenuSchema=new Schema({
    dayOfWeek:{
        type:String,
        required:true,
        enum:["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        unique:true
    },
    breakfast:{
        items:[{type:String}],
        startTime:{
            type:String,default:"07:30 AM"
        },
        endTime:{
            type:String,default:"09:00 AM"
        }
    },
    lunch: {
    items: [{ type: String }],
    startTime: { type: String, default: "01:00 PM" },
    endTime: { type: String, default: "02:30 PM" }
  },
  dinner: {
    items: [{ type: String }], 
    startTime: { type: String, default: "08:00 PM" },
    endTime: { type: String, default: "09:30 PM" }
  }
},{timestamps:true});

export default model("MessMenu",messMenuSchema);