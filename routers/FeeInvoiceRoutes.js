import { Router } from "express";
import { getFeeInvoice,getSpecificStudent, getFeeTemplates,handleCreateInvoice, addInvoicePayment } from "../controllers/adminController/FeeController.js";

const routes = Router();
routes.get("/",getFeeInvoice);
routes.post("/",handleCreateInvoice);
routes.get('/templates',getFeeTemplates);
routes.get('/student',getSpecificStudent);
routes.patch("/:invoiceId",addInvoicePayment)
export default routes;