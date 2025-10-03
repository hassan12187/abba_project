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
import { isAuthorized } from "./services/authentication.service.js";
import authRoutes from "./routers/authRoutes.js";
import cookieParser from "cookie-parser";
import csurf from "csurf";

config();
const app=express();
app.use(cors({
    origin:"http://localhost:3000",
    credentials:true
}));
const limiter = rateLimit({
    windowMs:15*60*1000,
    max:100
});
app.use(limiter);
app.use(express.json());
app.use(cookieParser());
// const csurfProtection=csurf({
    //     cookie:{
        //         httpOnly:false,
        //         secure:true,
        //         sameSite:'strict'
        //     }
        // });
        // app.use(csurfProtection);
        app.use("/static",staticRoutes);

app.use(authRoutes);
app.use("/api",isAuthorized);
app.use("/api",adminRoute);
app.use("/api/expense",expenseRoute);
app.use("/api/report",reportRoute);
app.use("/api",paymentRoute);

schedule('1 0 1 * *',async()=>{
console.log("generating montly report");
handleGenerateMontlyReport();
});
connectDB().then(()=>{
    app.listen(process.env.PORT,()=>{
        console.log(`the server is running on ${process.env.PORT}`);
    });
});