import { Router } from "express";
import {
  listPromptVersions,
  createLearningVersion,
  rollbackVersion,
  listFaq,
  createFaq,
  updateFaq,
  deleteFaq,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation
} from "../controllers/admin.controller.js";

const router = Router();

router.get("/prompt-versions",             listPromptVersions);
router.post("/prompt-versions/learning",   createLearningVersion);
router.post("/prompt-versions/:id/rollback", rollbackVersion);
router.get("/faq",                         listFaq);
router.post("/faq",                        createFaq);
router.put("/faq/:id",                     updateFaq);
router.delete("/faq/:id",                  deleteFaq);
router.get("/locations",                   listLocations);
router.post("/locations",                  createLocation);
router.put("/locations/:id",               updateLocation);
router.delete("/locations/:id",            deleteLocation);

export default router;
