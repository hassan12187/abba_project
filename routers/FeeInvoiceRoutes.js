import { Router } from "express";
import { getFeeInvoice,getSpecificStudent, addInvoice, getFeeTemplates,handleCreateInvoice } from "../controllers/adminController/FeeController.js";

const routes = Router();
routes.get("/",getFeeInvoice);
routes.post("/",handleCreateInvoice);
routes.get('/templates',getFeeTemplates);
routes.post('/',addInvoice);
routes.get('/student',getSpecificStudent);
export default routes;