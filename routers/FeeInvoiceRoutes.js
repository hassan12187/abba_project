import { Router } from "express";
import { getAllFeeInvoice, addInvoice, getFeeTemplates } from "../controllers/adminController/FeeController.js";

const routes = Router();
routes.get("/",getAllFeeInvoice);
routes.get('/templates',getFeeTemplates);
routes.post('/',addInvoice);
export default routes;