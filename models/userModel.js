import { Schema,model } from "mongoose";
const userSchema=new Schema({
    registration_no:{
        type:String
    },
    username:{
        type:String
    },
    email:{
        type:String
    },
    password:{
        type:String
    },
    status:{
        type:String,
        enum:["active","discontinued"],
        default:"active"
    },
    role:{
        type:String,
        enum:["ADMIN","STUDENT","SUPERADMIN"],
        default:"STUDENT"
    }
});
const userModel=model("user",userSchema);
export default userModel;