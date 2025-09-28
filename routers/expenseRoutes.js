import { Router } from "express";
import { getAllExpense,addExpense } from "../controllers/expenseController.js";
const routes=Router();
routes.get("/",getAllExpense);
routes.post("/",addExpense);
// routes.patch("/expense",editExpense);
export default routes;