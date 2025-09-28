import userModel from "../models/userModel";
import bcrypt from "bcrypt";

export const Login=async(req,res)=>{
    try {
        const {username,password}=req.body;
      const student = await userModel.findOne({username});
    if(!student)return res.send({status:302,data:"No matching student record was found."});
    
    } catch (error) {
        return res.send({status:500,data:"Oops! A server error occurred."});
    }
}