import { Router } from "express";
import { isAuthorized, isAuthorizedStudentOrAdmin } from "../services/authentication.service.js";
import { addComplain ,editComplain,getAllComplaints,getComplain} from "../controllers/complaintController.js";

const routes = Router();
routes.get('/admin/complaint',isAuthorized,getAllComplaints);
routes.post("/complaint",isAuthorizedStudentOrAdmin,addComplain);
routes.get('/complaint/:id',isAuthorizedStudentOrAdmin,getComplain);
routes.patch('/admin/complaint/:id',isAuthorized,editComplain);
export default routes;