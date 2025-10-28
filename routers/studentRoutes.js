import { Router } from "express";
import { getStudentDetails,getRoomMates } from "../controllers/studentController/studentController.js";
const routes = Router();
routes.get("/details",getStudentDetails);
routes.get('/room-mates',getRoomMates);
export default routes;