import { Router } from "express";
import { isAuthorized } from "../services/authentication.service.js";
import { addComplain ,getAllComplaints,getComplain} from "../controllers/complaintController.js";

const routes = Router();
routes.get('/admin/complaint',isAuthorized,getAllComplaints);
routes.post("/complaint",addComplain);
routes.get('/complaint/:id',getComplain);
routes.patch('/admin/complaint/:id',isAuthorized);
export default routes;