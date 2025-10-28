import { Router } from "express";
import { Login } from "../services/authentication.service.js";
import { checkLoginValidationMiddleware } from "../middleware/check.login.validation.js";
import { RegisterApplication } from "../controllers/StudentController/studentController.js";
import rateLimit from "express-rate-limit";
import { handleRequestPasswordChange, ChangePassword, verifyCode } from "../controllers/staficController/staticController.js";
const loginRateLimiting=rateLimit({
    windowMs:15*60*1000,
    limit:5,
    message:"Too Many Login Attemps. Plese try again later."
})
const routes = Router();
routes.post("/login",loginRateLimiting,checkLoginValidationMiddleware,Login);
routes.post("/admission-form",RegisterApplication);
routes.post('/forgot-password',handleRequestPasswordChange);
routes.post('/verify-code',verifyCode);
routes.patch('/change-password',ChangePassword)
export default routes;