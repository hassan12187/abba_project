import { Router } from "express";
import { handleUpdateProfileInformation,getProfileInformation,requestPasswordChange} from "../controllers/adminController/settingsController.js";

const routes=Router();
routes.get('/profile-information',getProfileInformation)
routes.patch('/profile-information/:id',handleUpdateProfileInformation);
routes.patch('/password/:id',requestPasswordChange);
export default routes;