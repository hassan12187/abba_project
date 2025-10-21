import { Router } from "express";
import { handleAddBlock, handleGetAllBlocks,handleGetBlocks,handleGetBlock } from "../controllers/hostelBlockController.js";

const routes=Router();
routes.get('/',handleGetAllBlocks);
routes.get('/query',handleGetBlocks);
routes.post('/',handleAddBlock);
routes.get("/:id",handleGetBlock)
export default routes;