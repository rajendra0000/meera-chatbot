import { Router } from "express";
import { sendMessage, getConversationMessages } from "../controllers/chat.controller.js";

const router = Router();

router.post("/", sendMessage);
router.get("/conversation/:id/messages", getConversationMessages);

export default router;
