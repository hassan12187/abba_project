import {Schema,model} from "mongoose";

const mealAttendanceSchema=new Schema({
    student:{
        type:Schema.Types.ObjectId,
        ref:"student_appication",
        required:true,
        index:true
    },
    date:{
        type:Date,
        required:true
    },
    mealType:{
        type:String,
        enum:["Breakfast","Lunch","Dinner"],
        required:true
    },
    status:{
        type:String,
        enum:["Present","Absent","Leave"],
        default:"Absent"
    }
    // totalPlatesServed:{
    //     type:Number,
    //     default:0
    // }
},{timestamps:true});

mealAttendanceSchema.index({student:1,date:1,mealType:1},{unique:true});

export default model("AttendanceRecord",mealAttendanceSchema);