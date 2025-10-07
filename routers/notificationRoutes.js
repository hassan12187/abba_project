import { Router } from "express";
import { markNotificationsRead, getNotifications } from "../controllers/notificationController.js";
const routes = Router();
routes.get("/",getNotifications);
routes.patch("/mark-read",markNotificationsRead);
export default routes;