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
import { isAuthorized } from "./services/authentication.service.js";
import authRoutes from "./routers/authRoutes.js";
// import studentApplicationModel from "./models/studentApplicationModel.js";
// import paymentModel from "./models/paymentModel.js";
import cookieParser from "cookie-parser";
config();
const app=express();
app.use(cors({
    origin:"http://127.0.0.1:5500",
    credentials:true
}));
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