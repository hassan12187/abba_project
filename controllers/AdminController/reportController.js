import expenseModel from "../../models/expenseModel.js";
import Payment from "../../models/paymentModel.js";
import Report from "../../models/reportModel.js";
import roomModel from "../../models/roomModel.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";

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
        const reports=await Report.findOne({date:{$gte:fromDate,$lte:toDate}});
        return res.send({status:200,data:"All Reports.",reports});
    } catch (error) {
        return res.send({status:500,data:"Internal Server Error."});
    }
};

export const getHomeDashboardStats=async(req,res)=>{
    try {
        const now = new Date();
const start = new Date(now.getFullYear(),now.getMonth(),1);
const end = new Date(now.getFullYear(),now.getMonth()+1,-1);
        const [totalStudents,occupiedRooms,paymentsDone,pendingApplications]=await Promise.all([
            studentApplicationModel.countDocuments({status:{$in:["accepted","approved","pending"]}}),
            roomModel.countDocuments({status:"occupied"}),
            Payment.countDocuments({paymentDate:{$gte:start,$lte:end}}),
            studentApplicationModel.countDocuments({status:"pending"})
        ]);
    return res.status(200).json({
        totalStudents:totalStudents||0,
        occupiedRooms:occupiedRooms||0,
        paymentsDone:paymentsDone||0,
        pendingApplications:pendingApplications||0
    });
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const getReportDashboardStats=async(req,res)=>{
    const sixMonthAgo=new Date();
    sixMonthAgo.setMonth(sixMonthAgo.getMonth()-6);
    sixMonthAgo.setDate(1);
    sixMonthAgo.setHours(0,0,0,0);
    try {
        const [
      reportsList, 
      currentStudentCount, 
      recentPayments, 
      recentExpenses
    ] = await Promise.all([
      // A. Get 6 months of reports for the charts
  // A. Get 6 months of reports for the charts
      Report.find({ reportDate: { $gte: sixMonthsAgo } }).sort({ reportDate: 1 }),
      
      // B. Get live total of currently enrolled students
      studentApplicationModel.countDocuments({$or:[{status:"accepted"},{status:"approved"}]}), // Adjust query to match your Student model
      
      // C. Get the 5 most recent payments for the details list
      Payment.find().sort({ createdAt: -1 }).limit(5),
      
      // D. Get the 5 most recent expenses for the details list
      expenseModel.find().sort({ createdAt: -1 }).limit(5)
    ]);
    console.log(reportsList);
        // const [totalStudents,totalPayments,totalExpenses,sixMonthAgoStats]=await Promise.all([
        //     studentApplicationModel.countDocuments({status:{$in:["accepted","approved"]}}),
        //     Payment.aggregate([
        //         {$group:{_id:null,total:{$sum:"$totalAmount"}}}
        //     ]),
        //     expenseModel.aggregate([
        //         {$group:{_id:null,total:{$sum:"$amount"}}}
        //     ]),
        //     Report.aggregate([
        //         {
        //             $match:{
        //                 reportDate:{$gt:sixMonthAgo}
        //             }
        //         },
        //         {
        //             $group:{
        //                 _id:{
                            
        //                     // year:{$year:"$reportDate"},
        //                     month:{$month:"$reportDate"}
        //                 },
        //                 income:{$sum:"$total_payments"},
        //                 expense:{$sum:"$total_expenses"}
        //             }
        //         },
        //         {
        //             $sort:{"_id.year":1,"_id.month":1}
        //         }
        //     ])
        // ]);
        // console.log(sixMonthAgoStats);
        // const incomes=[];
        // const expenses=[];
        // const formatedMonths=sixMonthAgoStats.map(item=>{
        //     const date = new Date(0,item._id.month-1,1);
        //     const monthName=date.toLocaleDateString('default',{month:'short'});
        //     incomes.push(item.income);
        //     expenses.push(item.expense);
        //     return monthName;
        // });
        // console.log(formatedMonths);
        // console.log(expenses);
        // console.log(incomes);
        // return res.status(200).json({
        //     totalStudents,
        //     totalPayments:totalPayments[0]?.total||0,
        //     totalExpenses:totalExpenses[0]?.total||0,
        //     netBalance:(totalPayments[0]?.total ||0) - (totalExpenses[0]?.total || 0),
        //     sixMonthAgoData:{
        //         months:formatedMonths,
        //         incomes,
        //         expenses
        //     }
        // });
        return res.sendStatus(200);
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
};