import { Router } from "express";
import { RegisterApplication } from "../controllers/studentController.js";
const routes = Router();
routes.post('/student',RegisterApplication);
export default routes;