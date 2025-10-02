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
// import { isAuthorized } from "./services/authentication.service.js";
import authRoutes from "./routers/authRoutes.js";
import cookieParser from "cookie-parser";
import crypto from "crypto";
config();
const app=express();
app.use(cors({
    origin:"http://127.0.0.1:5500",
    credentials:true
}));
app.use((req,res,next)=>{
    const csrfToken=crypto.randomBytes(32).toString("hex");
    res.cookie('csrfToken',csrfToken,{
        httpOnly:false,
        sameSite:'strict',
        secure:true,
    });
    res.locals.csrfToken=csrfToken;
    next();
})
const limiter = rateLimit({
    windowMs:15*60*1000,
    max:100
});
app.use(limiter);
app.use(cookieParser());
app.use(express.json());
app.use(authRoutes);
app.use("/static",staticRoutes);
// app.use("/api",isAuthorized);
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