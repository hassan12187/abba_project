import { Router } from "express";
import { handleAddBlock, handleGetAllBlocks,handleGetBlocks,handleGetBlock ,handleEditBlock} from "../controllers/adminController/hostelBlockController.js";

const routes=Router();
routes.get('/',handleGetAllBlocks);
routes.get('/query',handleGetBlocks);
routes.post('/',handleAddBlock);
routes.get("/:id",handleGetBlock)
routes.patch('/:id',handleEditBlock);
export default routes;