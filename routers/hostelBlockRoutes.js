import { Router } from "express";
import { handleAddBlock, handleGetAllBlocks,handleGetBlocks } from "../controllers/hostelBlockController.js";

const routes=Router();
routes.get('/',handleGetAllBlocks);
routes.get('/query',handleGetBlocks);
routes.post('/',handleAddBlock);
export default routes;