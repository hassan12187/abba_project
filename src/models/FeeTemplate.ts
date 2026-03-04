import {Schema,model} from "mongoose";

const lineItemsScehma=new Schema({
    description:{
        type:String,
        required:true
    },
    amount:{
        type:Number,
        required:true
    }
},{_id:false});

const FeesTemplateSchema=new Schema({
name:{
    type:String,
    required:true,
    unique:true,
    trim:true
},
description:{
    type:String
},
frequency:{
    type:String,
    enum:["OneTime","Monthly","Quarterly","Yearly"],
    required:true
},
roomType:{
  type:String  
},
category:{
    type:String,
    enum:["Room","Mess"],
    required:true
},
lineItems:[lineItemsScehma],
totalAmount:{
    type:Number,
    default:0
}
},{timestamps:true});

FeesTemplateSchema.pre("save",function(next){
    this.totalAmount=this.lineItems.reduce(
        (acc,item)=> acc +item.amount,
            0
    );
    next();
});
const FeeTemplate=model("FeeTemplate",FeesTemplateSchema);
export default FeeTemplate;