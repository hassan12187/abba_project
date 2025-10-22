import { Router } from "express";
import {addStaff,getStaffs} from "../controllers/staffController.js";
const routes = Router();
routes.get("/",getStaffs);
routes.post("/",addStaff);
export default routes;