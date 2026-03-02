import { Router } from "express";
import { getMessMenu ,updateMessMenu} from "../controllers/adminController/messController.js";

const routes=Router();
routes.get("/",getMessMenu);
routes.patch('/:day',updateMessMenu)
export default routes;