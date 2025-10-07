import { Router } from "express";
import { getAllExpense,addExpense } from "../controllers/expenseController.js";
import { verifyCsrf } from "../services/authentication.service.js";
const routes=Router();
routes.get("/",getAllExpense);
routes.post("/",addExpense);
// routes.patch("/expense",editExpense);
export default routes;