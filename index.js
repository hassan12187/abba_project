import express from "express";
import {config} from "dotenv";
import cors from "cors";
import studentRoute from "./routers/studentRoutes.js";
import adminRoute from "./routers/adminRoutes.js";
import connectDB from "./connection.js";
import expenseRoute from "./routers/expenseRoutes.js";
import paymentRoute from "./routers/paymentRoutes.js"
import reportRoute from "./routers/reportRoutes.js"
import { schedule } from "node-cron";
import expenseModel from "./models/expenseModel.js";
import mongoose from "mongoose";
import paymentModel from "./models/paymentModel.js";
import reportModel from "./models/reportModel.js";
import { handleGenerateMontlyReport } from "./services/monthlyReportService.js";
config();
const app=express();
app.use(cors());
// app.use(express.urlencoded({extended:true}));
app.use(express.json());
// app.use("/static",);
app.use("/static",studentRoute);
app.use("/api",adminRoute);
app.use("/api/expense",expenseRoute);
app.use("/api/payment",paymentRoute);
app.use("/api/report",reportRoute);

schedule('1 0 1 * *',async()=>{
console.log("generating montly report");
handleGenerateMontlyReport();
});
connectDB().then(()=>{
    app.listen(process.env.PORT,()=>{
        console.log(`the server is running on ${process.env.PORT}`);
    });
});