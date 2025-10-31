import { Router } from "express";
import { isAuthorized, isAuthorizedStudent } from "../services/authentication.service.js";
import { addComplain ,editComplain,getAllComplaints,getComplain,approveComplain} from "../controllers/adminController/complaintController.js";

const routes = Router();
routes.get('/admin/complaint',isAuthorized,getAllComplaints);
routes.post("/complaint",isAuthorizedStudent,addComplain);
routes.get('/complaint/:id',isAuthorizedStudent,getComplain);
routes.patch('/admin/complaint/:id',isAuthorized,editComplain);
routes.patch("/admin/approve-complaint/:id",isAuthorized,approveComplain);
export default routes;