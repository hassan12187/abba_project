import { Schema,model } from "mongoose";
import {hash,genSalt,getRounds} from "bcrypt";
const userSchema=new Schema({
    username:{
        type:String,
        required:[true,"Username is required."],
        minlength:[3,"Username must be at least 3 Characters."],
        maxlength:[30,"Username must be at most 30 Characters."],
        trim:true
    },
    email:{
        type:String,
        required:[true,"Email is required."],
        unique:true,
        lowercase:true,
        trim:true,
        match:[/.+\@.+\..+/,"Please enter a valid Email Address."]
    },
    password:{
        type:String,
        required:[true,"Password is required."],
        minlength:[6,"Password must be atleast 6 Characters."]
    },
    status:{
        type:String,
        enum:["ACTIVE","DISCONTINUED"],
        default:"ACTIVE"
    },
    role:{
        type:String,
        enum:["ADMIN","STUDENT","SUPERADMIN"],
        default:"STUDENT"
    }
});
userSchema.pre("save",async function(next){
    if(!this.isModified('password'))return next();
    const salt=await genSalt(10);
    const hashedPassword=await hash(this.password,salt);
    this.password=hashedPassword;
    next();
})
const userModel=model("user",userSchema);
export default userModel;