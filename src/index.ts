import express from "express";
import {config} from "dotenv";
import cors from "cors";
import adminRoute from "./routers/adminRoutes.js";
import staticRoutes from "./routers/staticRoutes.js";
import connectDB from "./connection.js";
import feeRoutes from "./modules/feeInvoice/feeinvoice.routes.js";
import {expenseRouter} from "./modules/expense/expenseRoutes.js";
import {paymentRouter} from "./modules/payment/payment.routes.js"
import {reportRouter} from "./modules/reports/report.routes.js"
import { schedule } from "node-cron";
import { handleGenerateMontlyReport } from "./services/monthlyReportService.js";
import rateLimit from "express-rate-limit";
import { isAuthorized, isAuthorizedStudent } from "./services/authentication.service.js";
import authRoutes from "./routers/authRoutes.js";
import MenuRoutes from "./modules/messmenu/messmenu.routes.js";
import notificationRoutes from "./routers/notificationRoutes.js";
// import hostelBlockRoutes from "./modules/block/hostelBlockRoutes.js";
import {blockRouter} from "./modules/hostel/hostel.routes.js";
import {roomRouter} from "./modules/hostel/hostel.routes.js";
import settingsRoute from "./routers/settingsRoute.js";
import maintenanceStaffRoutes from "./routers/maintenanceStaffRoutes.js";
import {complaintRouter} from "./modules/complaint/complaint.routes.js";
import applicationRoute from "./modules/student.application/studentapplication.routes.js";
import studentRoutes from "./routers/studentRoutes.js";
import messRoutes from "./modules/messSubscription/messSubscription.routes.js";
import messSubscriptionRoutes from "./modules/messSubscription/messSubscription.routes.js";
import cookieParser from "cookie-parser";
import {Server} from "socket.io";
import {createServer} from "http";
import WebSocketService from "./services/socket.service.js";
import "./services/agenda.js";  
import "./queues/emailWorker.js";
import helmet from "helmet";
import { generateMonthlyFees } from "./services/FeeService.js";
import {globalErrorHandler} from "./middleware/error.middleware.js";
// import "./modules/payment/payment.model.js";

const app=express();
const allowedOrigins=[process.env.ADMIN_FRONTEND_ORIGIN,process.env.STUDENT_PORTAL_FRONTEND_ORIGIN];

app.use(helmet());
app.use(cors({
    origin:function(origin,callback){
        if(!origin || allowedOrigins.includes(origin)){
            callback(null,true);
        }else{
            callback(new Error("Not Allowed."));
        }
    },
    credentials:true
}));
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
    windowMs:15*60*1000,
    max:100,
});
app.use("/static",staticRoutes);
app.use(limiter);
        
app.use(authRoutes);
// Admin Routes
// app.use("/api/admin",isAuthorized);
app.use("/api/admin",adminRoute);
app.use("/api/admin/complaints",complaintRouter);
app.use("/api/admin/applications",applicationRoute);
app.use("/api/admin/expenses",expenseRouter);
app.use("/api/admin/report",reportRouter);
app.use("/api/admin/payments",paymentRouter);
app.use("/api/admin/blocks",blockRouter);
app.use("/api/admin/rooms",roomRouter);
app.use("/api/admin/settings",settingsRoute);
app.use("/api/notification",notificationRoutes);
app.use("/api/admin/maintenance-staff",maintenanceStaffRoutes);
app.use("/api/admin/invoices",feeRoutes);
app.use("/api/admin/mess",messRoutes);
app.use("/api/admin/menus",MenuRoutes);
app.use("/api/admin/subscriptions",messSubscriptionRoutes)

// Common between admin and student
// const now = new Date();
// const startOfMonth=new Date(now.getFullYear(),now.getMonth());
//     const endDate=new Date(now.getFullYear(),now.getMonth()+1);
//     console.log(startOfMonth);
//     console.log(endDate);
// Student Routes
app.use("/api/student",isAuthorizedStudent,studentRoutes);


app.use(globalErrorHandler)
// schedule('1 0 1 * *',async()=>{
// console.log("generating montly report");
// handleGenerateMontlyReport();
// });
schedule("0 0 1 * *",async()=>{
    const now = new Date();
    await generateMonthlyFees(now.getFullYear(),now.getMonth()+1);
});
const server = createServer(app);
export const io = new Server(server,{
    cors:{
        origin:process.env.ADMIN_FRONTEND_ORIGIN,
        credentials:true,
    },
});

WebSocketService();
connectDB().then(()=>{
    server.listen(process.env.PORT,async()=>{
        //     let cursor="0";
        // do {
        //     const reply = await redis.scan(cursor,'MATCH','messMenu*','COUNT',100);
        //     cursor=reply[0];
        //     const keys = reply[1];
        //     if(keys.length>0){
        //         await redis.del(...keys);
        //     }
        // } while (cursor!=="0"); 
     console.log(`the server is running on ${process.env.PORT}`);
    })
});