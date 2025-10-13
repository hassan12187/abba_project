import { Router } from "express";
import { handleAddPayment, handleGetAllPayment, handleGetPayments } from "../controllers/paymentController.js";
import { verifyCsrf } from "../services/authentication.service.js";
const routes=Router();
routes.post("/",handleAddPayment);
routes.get("/",handleGetPayments);
// routes.get("/payment",handleGetAllPayment);
export default routes;