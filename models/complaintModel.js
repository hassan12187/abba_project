import {Schema,model} from "mongoose";

const complaintSchema=new Schema({
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
    title:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    priority:{
        type:String,
        enum:["high","medium","low"],
        default:"medium"
    },
    category:{
        type:String,
        enum:["electrical", "plumbing", "cleaning", "furniture", "other"],
        default:"other"
    },
    status:{
        type:String,
        enum:["Pending","Resolved","In Progress","Rejected"],
        default:"Pending"
    },
    assigned_to:{
        type:Schema.Types.ObjectId,
        ref:"MaintenanceStaff"
    },
    admin_comments:String,
    created_at:{
        type:Date,
        default:Date.now
    },
    updated_at:{
        type:Date,
        default:Date.now
    }
});
const ComplainModel=model('Complaint',complaintSchema);
export default ComplainModel