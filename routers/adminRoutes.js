import { Router } from "express";
import { getAllStudents, getStudent, editStudent, getRooms, addRoom,getStudentApplications,handleGetRoomsWithBlock } from "../controllers/adminController.js";
import { verifyCsrf } from "../services/authentication.service.js";

const routes = Router();
routes.get("/students",getAllStudents);
routes.get("/student/application",getStudentApplications);
routes.get('/room',getRooms);
routes.get('/room/block',handleGetRoomsWithBlock);
routes.post('/room',addRoom);
routes.get("/student/:id",getStudent);
routes.patch("/student/:id",verifyCsrf,editStudent);
export default routes;