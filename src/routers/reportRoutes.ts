import { Router } from "express";
import { getHomeDashboardStats, getReportDashboardStats, handleGetReport } from "../controllers/adminController/reportController.js";
import { getDashboard} from "../modules/dashboard/dashboard.routes.js";

const routes=Router();
routes.get("/",getReportDashboardStats);
routes.get('/home-dashboard',getDashboard);
export default routes;