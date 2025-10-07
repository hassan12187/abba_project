import { Router } from "express";
import { Login } from "../services/authentication.service.js";
import { checkLoginValidationMiddleware } from "../middleware/check.login.validation.js";
import { RegisterApplication } from "../controllers/studentController.js";
const routes = Router();
routes.post("/login",checkLoginValidationMiddleware,Login);
routes.post("/admission-form",RegisterApplication);
export default routes;