import { Router } from "express";
import { handleGupshupWebhook } from "../controllers/webhook.controller.js";

/**
 * Gupshup inbound webhook.
 *
 * Register this URL in your Gupshup console (Messaging → App → Callback URL):
 *   POST https://<your-domain>/webhook/gupshup
 *
 * Test locally with ngrok:
 *   curl -X POST https://<ngrok-url>/webhook/gupshup \
 *     -H "Content-Type: application/json" \
 *     -d '{"payload":{"type":"text","source":"919876543210","payload":{"text":"hello"},"sender":{"name":"Test"}}}'
 */
const router = Router();

router.post("/gupshup", handleGupshupWebhook);

export default router;
