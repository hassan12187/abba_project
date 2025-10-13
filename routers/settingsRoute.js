import { Router } from "express";
import { handleProfileInformation,getProfileInformation} from "../controllers/settingsController.js";

const routes=Router();
routes.get('/profile-information',getProfileInformation)
routes.patch('/profile-information',handleProfileInformation);
export default routes;