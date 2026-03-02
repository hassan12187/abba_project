import {Schema,model} from "mongoose";

const mealAttendanceSchema=new Schema({
    date:{
        type:Date,
        required:true
    },
    mealType:{
        type:String,
        enum:["Breakfast","Lunch","Dinner"],
        required:true
    },
    studentsAttended:[{
        type:Schema.Types.ObjectId,
        ref:"student_application"
    }],
    totalPlatesServed:{
        type:Number,
        default:0
    }
},{timestamps:true});

mealAttendanceSchema.index({date:1,mealType:1},{unique:true});

export default model("MealAttendance",mealAttendanceSchema);