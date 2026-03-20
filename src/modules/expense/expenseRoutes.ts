import { Router } from "express";
import { getAllExpense,addExpense ,getExpense} from "./expenseController.js";

const routes=Router();
routes.get("/",getAllExpense);
routes.post("/",addExpense);
routes.get('/:id',getExpense);
// routes.patch("/expense",editExpense);
export default routes;