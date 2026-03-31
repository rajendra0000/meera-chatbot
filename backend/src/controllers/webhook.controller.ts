import { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { ConversationChannel } from "@prisma/client";
import { processChat } from "../services/chat.service.js";
import { sendGupshupText } from "../services/gupshup.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Webhook controller — Gupshup inbound message handling
// ─────────────────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.GUPSHUP_WEBHOOK_SECRET ?? "";

/** Verify Gupshup HMAC-SHA256 signature.
 *  Signature header: x-gupshup-signature = hex(HMAC-SHA256(secret, rawBody))
 *  Returns true if valid, or if secret is not configured (dev bypass). */
function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[webhook] GUPSHUP_WEBHOOK_SECRET not set — skipping signature check (dev mode)");
    return true;
  }
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signatureHeader, "hex"));
  } catch {
    return false;
  }
}

export async function handleGupshupWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Signature check — uses rawBody attached by express.raw() or express.json()
    const rawBody: Buffer = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const signature = req.headers["x-gupshup-signature"] as string | undefined;
    if (!verifySignature(rawBody, signature)) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    const outer = req.body;

    // Parse Gupshup native payload format
    const gupshupPayload = outer?.payload;
    if (!gupshupPayload || gupshupPayload.type !== "text") {
      res.json({ ok: true, skipped: true, reason: "non-text or empty payload" });
      return;
    }

    const text: string = (gupshupPayload?.payload?.text ?? "").trim();
    const contactId: string =
      gupshupPayload.source ?? gupshupPayload.sender?.phone ?? "unknown";

    if (!text) {
      res.json({ ok: true, skipped: true, reason: "empty text body" });
      return;
    }

    const result = await processChat({
      message: text,
      channel: ConversationChannel.GUPSHUP,
      contactId
    });

    if (contactId !== "unknown" && result.replyText) {
      await sendGupshupText(contactId, result.replyText);
    }

    res.json({ ok: true, result });
  } catch (error) {
    console.error("[webhook.controller.handleGupshupWebhook]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

