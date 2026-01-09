import { Router } from "express";
import { getAllFeeInvoice, addInvoice } from "../controllers/adminController/FeeInvoiceController.js";

const routes = Router();
routes.get("/",getAllFeeInvoice);
routes.post('/',addInvoice);
export default routes;