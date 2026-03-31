import { Router } from "express";
import {
  getStats,
  getLeads,
  getLeadById,
  exportLeadCsv,
  exportAllLeadsCsv,
  loadDemoData,
  getFollowUpLayers
} from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/stats",                  getStats);
router.get("/leads",                  getLeads);
router.get("/leads/:id",              getLeadById);
router.get("/leads/:id/export.csv",   exportLeadCsv);
router.get("/export.csv",             exportAllLeadsCsv);
router.post("/demo/load",             loadDemoData);
router.post("/leads/:id/follow-up",   getFollowUpLayers);

export default router;
