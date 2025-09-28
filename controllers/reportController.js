import reportModel from "../models/reportModel.js";

export const handleGetReport=async(req,res)=>{
    try {
        const {from_date,to_date}=req.headers;
        let fromDate;
        let toDate;
        if(from_date && to_date){
            fromDate=new Date(from_date);
            toDate=new Date(to_date);
        }
        if(from_date && !to_date){
            fromDate=new Date(from_date);
            toDate=new Date(fromDate.getFullYear(),fromDate.getMonth()+1,1);    
        };
        if(!from_date && to_date){
            toDate=new Date(to_date);
            fromDate=new Date(toDate.getFullYear(),toDate.getMonth(),2);  
        };
        const reports=await reportModel.findOne({date:{$gte:fromDate,$lte:toDate}});
        return res.send({status:200,data:"All Reports.",reports});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
}