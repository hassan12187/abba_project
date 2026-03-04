import {Schema,model} from "mongoose";
const maintenanceSchema=new Schema({
    complain:{
        type:Schema.Types.ObjectId,
        ref:"Complaint",
        required:true
    },
    room:{
        type:Schema.Types.ObjectId,
        ref:"room",
        required:true
    },
    amenities:[
        {
            type:Schema.Types.ObjectId,
            ref:"amenity"
        }
    ],
    issue_description:{
        type:String,
        required:true
    },
    status:{
        type:String,
        enum:["Pending","In Progress","Resolved"],
        default:"Pending"
    },
    report_date:{
        type:Date,
        default:Date.now
    },
    resolved_date:{
        type:Date,
    },
    handled_by:{
        type:Schema.Types.ObjectId,
        ref:"MaintenanceStaff"
    }
});
const MaintenanceModel=model("maintenance",maintenanceSchema);
export default MaintenanceModel;