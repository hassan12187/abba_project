import { Router } from "express";
import { getAllFeeInvoice,getSpecificStudent, addInvoice, getFeeTemplates } from "../controllers/adminController/FeeController.js";

const routes = Router();
routes.get("/",getAllFeeInvoice);
routes.get('/templates',getFeeTemplates);
routes.get('/student',getSpecificStudent);
routes.post('/',addInvoice);
export default routes;