import { Router } from "express";
import { getStudentDetails,getRoomMates,getStudentRoom,getComplaints,addComplaint } from "../controllers/studentController/studentController.js";
const routes = Router();
routes.get("/details",getStudentDetails);
routes.get('/room-mates',getRoomMates);
routes.get('/room',getStudentRoom);
routes.get('/complaints',getComplaints);
routes.post("/complaint",addComplaint);
export default routes;