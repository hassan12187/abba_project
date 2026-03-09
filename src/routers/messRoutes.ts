import { Router } from "express";
import { getMessMenu ,updateMessMenu,getMessAttendance, createSubscription, verifyMessAccess, renewSubscription,getAllSubscriptions} from "../controllers/adminController/messController.js";

const routes=Router();
routes.get("/menu",getMessMenu);
routes.get('/attendace',getMessAttendance);
routes.get('/subscription',getAllSubscriptions);
routes.get("/verify-access/:studentId",verifyMessAccess);
routes.post("/subscription/:studentId",createSubscription);
routes.patch("/subscription/:studentId",renewSubscription);
routes.patch('/menu/:day',updateMessMenu);
export default routes;