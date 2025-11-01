import { Router } from "express";
import { getStudentDetails,getRoomMates,getStudentRoom } from "../controllers/studentController/studentController.js";
const routes = Router();
routes.get("/details",getStudentDetails);
routes.get('/room-mates',getRoomMates);
routes.get('/room',getStudentRoom);
export default routes;