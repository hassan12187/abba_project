import {Schema,model} from "mongoose";

const studentApplicationSchema=new Schema({
    student_name:{
        type:String,
        required:[true,"Student Name is Required."],
        minlength:[3,"Student Name must be at least 3 Characters."],
        maxlength:[30,"Student Name must be at most 30 Characters."],
        trim:true
    },
    student_email:{
        type:String,
        required:[true,"Email is Required."],
        match:[/.+\@.+\..+/,"Please enter a valid Email Address."],
        lowercase:true,
        trim:true,
        unique:true
    },
    student_roll_no:{
        type:Number,
        unique:true
    },
    father_name:{
        type:String,
        required:[true,"Father Name is Required."],
        minlength:[3,"Father Name must be atleast 3 Characters."],
        maxlength:[30,"Father Name must be alteast 30 Characters."],
        trim:true
    },
    student_cellphone:{
        type:String
    },
    student_reg_no:{
        type:String
    },
    father_cellphone:{
        type:String
    },
    guardian_name:{
        type:String,
        minlength:[3,"Guardian Name must me atleast 3 Characters."],
        maxlength:[30,"Guardian Nae must me at most of 30 Characters."],
        trim:true
    },
    guardian_cellphone:{
        type:String
    },
    cnic_no:{
        type:String
    },
    active_whatsapp_no:{
        type:String
    },
    postal_address:{
        type:String
    },
    permanent_address:{
        type:String
    },
    city:{
        type:String
    },
    province:{
        type:String
    },
    student_image:{
        type:String
    },
    cnic_image:{
        type:[String]
    },
    date_of_birth:{
        type:String
    },
    academic_year:{
        type:String
    },
    gender:{
        type:String,
        enum:["male","female"]
    },
    status:{
        type:String,
        enum:["accepted","pending","rejected","approved"],
        default:"pending"
    },
    application_submit_date:{
        type:Date,
        default:Date.now,
        immutable:true
    },
    room_id:{
        type:Schema.Types.ObjectId,
        ref:"room"
    }
});
const studentApplicationModel=model("student_application",studentApplicationSchema);
export default studentApplicationModel;