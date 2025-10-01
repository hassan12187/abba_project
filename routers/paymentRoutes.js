import { Router } from "express";
import { handleAddPayment, handleGetAllPayment, handleGetPayments } from "../controllers/paymentController.js";
const routes=Router();
routes.post("/payment",handleAddPayment);
routes.get("/payment",handleGetPayments);
// routes.get("/payment",handleGetAllPayment);
export default routes;