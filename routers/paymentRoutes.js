import { Router } from "express";
import { handleAddPayment, handleGetAllPayment, handleGetPayments } from "../controllers/paymentController.js";
import { verifyCsrf } from "../services/authentication.service.js";
const routes=Router();
routes.post("/payment",verifyCsrf,handleAddPayment);
routes.get("/payment",handleGetPayments);
// routes.get("/payment",handleGetAllPayment);
export default routes;