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
import studentApplicationModel from "./models/studentApplicationModel.js";
config();
const app=express();
app.use(cors());
app.use(express.json());
app.use("/static",staticRoutes);
app.use("/api",isAuthorized);
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