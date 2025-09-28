import { Router } from "express";
import { handleGetReport } from "../controllers/reportController.js";
const routes=Router();
routes.get("/",handleGetReport);
export default routes;