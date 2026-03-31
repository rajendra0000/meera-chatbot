import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { createLearningPromptVersion, rollbackPromptVersion } from "../services/prompt.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Admin controller — self-learning sandbox endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function listPromptVersions(_req: Request, res: Response): Promise<void> {
  try {
    const versions = await prisma.promptVersion.findMany({
      orderBy: [{ type: "asc" }, { versionNumber: "desc" }]
    });
    res.json(versions);
  } catch (error) {
    console.error("[admin.controller.listPromptVersions]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createLearningVersion(req: Request, res: Response): Promise<void> {
  try {
    const content = String(req.body.content ?? "").trim();
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const version = await createLearningPromptVersion(content);
    res.json(version);
  } catch (error) {
    console.error("[admin.controller.createLearningVersion]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function rollbackVersion(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const version = await rollbackPromptVersion(id);
    res.json(version);
  } catch (error) {
    console.error("[admin.controller.rollbackVersion]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listFaq(_req: Request, res: Response): Promise<void> {
  try {
    const entries = await prisma.faqEntry.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(entries);
  } catch (error) {
    console.error("[admin.controller.listFaq]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createFaq(req: Request, res: Response): Promise<void> {
  try {
    const question = String(req.body.question ?? "").trim();
    const answer = String(req.body.answer ?? "").trim();
    const category = String(req.body.category ?? "").trim();
    const keywords = String(req.body.keywords ?? "").trim();

    if (!question || !answer || !category || !keywords) {
      res.status(400).json({ error: "question, answer, category, and keywords are required" });
      return;
    }

    const entry = await prisma.faqEntry.create({
      data: { question, answer, category, keywords }
    });
    res.json(entry);
  } catch (error) {
    console.error("[admin.controller.createFaq]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateFaq(req: Request, res: Response): Promise<void> {
  try {
    const question = String(req.body.question ?? "").trim();
    const answer = String(req.body.answer ?? "").trim();
    const category = String(req.body.category ?? "").trim();
    const keywords = String(req.body.keywords ?? "").trim();

    if (!question || !answer || !category || !keywords) {
      res.status(400).json({ error: "question, answer, category, and keywords are required" });
      return;
    }

    const entry = await prisma.faqEntry.update({
      where: { id: String(req.params.id) },
      data: { question, answer, category, keywords }
    });
    res.json(entry);
  } catch (error) {
    console.error("[admin.controller.updateFaq]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteFaq(req: Request, res: Response): Promise<void> {
  try {
    await prisma.faqEntry.delete({
      where: { id: String(req.params.id) }
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("[admin.controller.deleteFaq]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listLocations(_req: Request, res: Response): Promise<void> {
  try {
    const locations = await prisma.showroom.findMany({
      orderBy: { city: "asc" }
    });
    res.json(locations);
  } catch (error) {
    console.error("[admin.controller.listLocations]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createLocation(req: Request, res: Response): Promise<void> {
  try {
    const name = String(req.body.name ?? "").trim();
    const city = String(req.body.city ?? "").trim();
    const address = String(req.body.address ?? "").trim();
    const contact = String(req.body.contact ?? "").trim();

    if (!name || !city || !address) {
      res.status(400).json({ error: "name, city, and address are required" });
      return;
    }

    const location = await prisma.showroom.create({
      data: {
        id: randomUUID(),
        name,
        city,
        address,
        contact: contact || null
      }
    });
    res.json(location);
  } catch (error) {
    console.error("[admin.controller.createLocation]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateLocation(req: Request, res: Response): Promise<void> {
  try {
    const name = String(req.body.name ?? "").trim();
    const city = String(req.body.city ?? "").trim();
    const address = String(req.body.address ?? "").trim();
    const contact = String(req.body.contact ?? "").trim();

    if (!name || !city || !address) {
      res.status(400).json({ error: "name, city, and address are required" });
      return;
    }

    const location = await prisma.showroom.update({
      where: { id: String(req.params.id) },
      data: {
        name,
        city,
        address,
        contact: contact || null
      }
    });
    res.json(location);
  } catch (error) {
    console.error("[admin.controller.updateLocation]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteLocation(req: Request, res: Response): Promise<void> {
  try {
    await prisma.showroom.delete({
      where: { id: String(req.params.id) }
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("[admin.controller.deleteLocation]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
