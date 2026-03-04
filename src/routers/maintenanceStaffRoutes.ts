import { Router } from "express";
import {addStaff,editStaff,getStaff,getStaffs} from "../controllers/adminController/staffController.js";
const routes = Router();
routes.get("/",getStaffs);
routes.post("/",addStaff);
routes.get("/:id",getStaff);
routes.patch("/:id",editStaff);
export default routes;