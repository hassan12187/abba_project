import mongoose, {Schema,model} from "mongoose";
const notificationSchema=new Schema({
    message:{
        type:String,required:true
    },
    application_id:{
        type:mongoose.Types.ObjectId,
        ref:"student_application",
    },
    isRead:{
        type:Boolean,
        default:false
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
});
const NotificationModel=model('notification',notificationSchema);
export default NotificationModel;