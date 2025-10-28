import { Router } from "express";
import { handleRefreshToken, handleLogout } from "../controllers/staficController/authController.js";

const routes=Router();
routes.post('/refresh-token',handleRefreshToken);
routes.post('/logout',handleLogout);
export default routes;