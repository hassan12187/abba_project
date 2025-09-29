import { Router } from "express";
import { Login } from "../services/authentication.service.js";
import { checkLoginValidationMiddleware } from "../middleware/check.login.validation.js";
const routes = Router();
routes.post("/login",checkLoginValidationMiddleware,Login);
export default routes;