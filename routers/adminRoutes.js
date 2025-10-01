import { Router } from "express";
import { getAllStudents, getStudent, editStudent, getRooms, addRoom,getStudentApplications } from "../controllers/adminController.js";

const routes = Router();
routes.get("/student",getAllStudents);
routes.get("/student/application",getStudentApplications);
routes.get('/room',getRooms);
routes.post('/room',addRoom);
routes.get("/student/:id",getStudent);
routes.patch("/student/:id",editStudent);
export default routes;