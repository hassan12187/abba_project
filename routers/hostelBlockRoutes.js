import { Router } from "express";
import { handleAddBlock, handleGetBlocks } from "../controllers/hostelBlockController.js";

const routes=Router();
routes.get('/',handleGetBlocks);
routes.post('/',handleAddBlock);
export default routes;