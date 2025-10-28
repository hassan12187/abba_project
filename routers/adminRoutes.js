import { Router } from "express";
import { getAllStudents, getStudent, assignRoom, getRooms,getRoom, addRoom,getStudentApplications,handleGetRoomsWithBlock,approveStudentApplication } from "../controllers/adminController/adminController.js";

const routes = Router();
routes.get("/students",getAllStudents);
routes.get("/student/application",getStudentApplications);
routes.get('/room',getRooms);
routes.get('/room/block',handleGetRoomsWithBlock);
routes.post('/room',addRoom);
routes.get("/room/:id",getRoom);
routes.get("/student/:id",getStudent);
routes.patch("/student-room/:id",assignRoom);
routes.patch("/student/approve-application/:id",approveStudentApplication)
export default routes;