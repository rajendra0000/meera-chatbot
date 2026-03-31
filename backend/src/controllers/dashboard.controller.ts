import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { estimateOrderValue, getDashboardSnapshot, getLeadDetail } from "../services/lead.service.js";
import { seedAll } from "../../prisma/seed.js";

// ─────────────────────────────────────────────────────────────────────────────
// CSV formatting helpers (presentation logic, belongs in controller layer)
// ─────────────────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined || String(value).trim() === ""
      ? "Not specified"
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value: Date | string): string {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

type LeadWithConversation = Awaited<ReturnType<typeof getLeadDetail>>;

function getCollectedData(lead: NonNullable<LeadWithConversation>) {
  return (lead.conversation?.collectedData as Record<string, string | number | boolean | undefined>) ?? {};
}

function getEstimatedOrderValue(lead: NonNullable<LeadWithConversation>): number {
  if (lead.estimatedOrderValue) return lead.estimatedOrderValue;
  return estimateOrderValue({
    budget: lead.investmentRange ?? "Not specified",
    areaSqft: lead.areaSqft ?? "Not specified"
  });
}

function buildCsvRow(lead: NonNullable<LeadWithConversation>): string {
  const collectedData = getCollectedData(lead);
  const row = [
    lead.name,
    lead.score,
    lead.status,
    lead.productInterest,
    lead.investmentRange,
    lead.areaSqft ?? "Not specified",
    collectedData.roomType ?? "Not specified",
    collectedData.style ?? "Not specified",
    lead.showroomCity ?? collectedData.city ?? "Not specified",
    lead.timeline,
    lead.triggerType,
    lead.wantsCallback,
    lead.wantsSample,
    getEstimatedOrderValue(lead),
    formatDate(lead.createdAt)
  ];
  return row.map(csvCell).join(",");
}

const CSV_HEADERS =
  "name,score,status,interest,investment,area_sqft,room_type,style,city,timeline,trigger,wants_callback,wants_sample,estimated_order_value,created_at";

// ─────────────────────────────────────────────────────────────────────────────
// Controller methods
// ─────────────────────────────────────────────────────────────────────────────

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const snapshot = await getDashboardSnapshot();
    res.json(snapshot.stats);
  } catch (error) {
    console.error("[dashboard.controller.getStats]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getLeads(req: Request, res: Response): Promise<void> {
  try {
    const filter = typeof req.query.filter === "string" ? req.query.filter : undefined;
    const snapshot = await getDashboardSnapshot(filter);
    res.json(snapshot.leads);
  } catch (error) {
    console.error("[dashboard.controller.getLeads]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getLeadById(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getLeadDetail(String(req.params.id));
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(lead);
  } catch (error) {
    console.error("[dashboard.controller.getLeadById]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function exportLeadCsv(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getLeadDetail(String(req.params.id));
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const csv = [CSV_HEADERS, buildCsvRow(lead)].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=lead-${lead.id}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("[dashboard.controller.exportLeadCsv]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function exportAllLeadsCsv(_req: Request, res: Response): Promise<void> {
  try {
    const leads = await prisma.lead.findMany({
      include: { conversation: true },
      orderBy: { updatedAt: "desc" }
    });
    const rows = leads.map((lead) => buildCsvRow(lead as NonNullable<LeadWithConversation>));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=hey-concrete-leads.csv");
    res.send([CSV_HEADERS, ...rows].join("\n"));
  } catch (error) {
    console.error("[dashboard.controller.exportAllLeadsCsv]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function loadDemoData(_req: Request, res: Response): Promise<void> {
  try {
    await seedAll();
    res.json({ ok: true });
  } catch (error) {
    console.error("[dashboard.controller.loadDemoData]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getFollowUpLayers(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getLeadDetail(String(req.params.id));
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    const name = lead.name ?? "there";
    const interest = lead.productInterest ?? "Hey Concrete surfaces";
    const city = lead.showroomCity ?? "your city";

    res.json({
      leadId: lead.id,
      layers: [
        {
          layer: 1,
          title: "Thank-you note and recommendation recap",
          message: `Hi ${name}! 🙏 Thank you for exploring Hey Concrete. Based on our chat, ${interest} could be a stunning upgrade for your space. We've transformed 3,000+ homes - would love yours to be next! Shall I arrange a callback? 😊`
        },
        {
          layer: 2,
          title: "Share showroom or callback slot",
          message: `Hi ${name}! Our ${city} showroom experience is something photos can't capture - you need to touch the texture to truly feel it ✨ Want me to book a slot for you this week?`
        },
        {
          layer: 3,
          title: "Offer sample discussion",
          message: `Hi ${name}! A physical sample of ${interest} can completely change how you visualize the final look 🏠 Want us to send one to your address? It's the best way to decide.`
        },
        {
          layer: 4,
          title: "Nudge on decision timeline",
          message: `Hi ${name}! Just checking in - has your timeline for the ${interest} project moved forward? Our team is ready whenever you are 🌿 Happy to help you finalize.`
        },
        {
          layer: 5,
          title: "Manual Kabir handover",
          message: `Hi ${name}! Kabir from our team would love to connect personally - he's helped 100s of clients in ${city} find the perfect surface solution for their space. Shall I share his contact? 😊`
        }
      ]
    });
  } catch (error) {
    console.error("[dashboard.controller.getFollowUpLayers]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
