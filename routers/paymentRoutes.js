import { Router } from "express";
import { handleAddPayment, handleGetPayment } from "../controllers/paymentController.js";
const routes=Router();
routes.post("/",handleAddPayment);
routes.get("/",handleGetPayment);
export default routes;