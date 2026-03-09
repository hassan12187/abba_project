import express from "express";
import {config} from "dotenv";
import cors from "cors";
import adminRoute from "./routers/adminRoutes.js";
import staticRoutes from "./routers/staticRoutes.js";
import connectDB from "./connection.js";
import expenseRoute from "./routers/expenseRoutes.js";
import paymentRoute from "./routers/paymentRoutes.js"
import reportRoute from "./routers/reportRoutes.js"
import { schedule } from "node-cron";
import { handleGenerateMontlyReport } from "./services/monthlyReportService.js";
import rateLimit from "express-rate-limit";
import { isAuthorized, isAuthorizedStudent } from "./services/authentication.service.js";
import authRoutes from "./routers/authRoutes.js";
import notificationRoutes from "./routers/notificationRoutes.js";
import hostelBlockRoutes from "./routers/hostelBlockRoutes.js";
import settingsRoute from "./routers/settingsRoute.js";
import maintenanceStaffRoutes from "./routers/maintenanceStaffRoutes.js";
import complaintRoutes from "./routers/complaintRoutes.js";
import feeRoutes from "./routers/FeeInvoiceRoutes.js";
import studentRoutes from "./routers/studentRoutes.js";
import messRoutes from "./routers/messRoutes.js";
import cookieParser from "cookie-parser";
import {Server} from "socket.io";
import {createServer} from "http";
import WebSocketService from "./services/socket.service.js";
import "./services/agenda.js";  
import "./queues/emailWorker.js";
import helmet from "helmet";
import { generateMonthlyFees } from "./services/FeeService.js";
import redis from "./services/Redis.js";

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
app.use("/api",complaintRoutes);
// app.use("/api/admin",isAuthorized);
app.use("/api/admin",adminRoute);
app.use("/api/admin/expense",expenseRoute);
app.use("/api/admin/report",reportRoute);
app.use("/api/admin/payment",paymentRoute);
app.use("/api/admin/block",hostelBlockRoutes);
app.use("/api/admin/settings",settingsRoute);
app.use("/api/notification",notificationRoutes);
app.use("/api/admin/maintenance-staff",maintenanceStaffRoutes);
app.use("/api/admin/fee-invoice",feeRoutes);
app.use("/api/admin/mess",messRoutes);

// Common between admin and student
// const now = new Date();
// const startOfMonth=new Date(now.getFullYear(),now.getMonth());
//     const endDate=new Date(now.getFullYear(),now.getMonth()+1);
//     console.log(startOfMonth);
//     console.log(endDate);
// Student Routes
app.use("/api/student",isAuthorizedStudent,studentRoutes);

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