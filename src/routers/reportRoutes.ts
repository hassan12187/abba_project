import { Router } from "express";
import { getHomeDashboardStats, getReportDashboardStats, handleGetReport } from "../controllers/adminController/reportController.js";
const routes=Router();
routes.get("/",getReportDashboardStats);
routes.get('/home-dashboard',getHomeDashboardStats);
export default routes;