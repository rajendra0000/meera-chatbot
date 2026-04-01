import { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HANDOVER_KEYWORDS } from "../constants/handover.constants.js";
import { VALID_BUDGETS } from "../constants/budget.constants.js";
import { VALID_AREAS } from "../constants/area.constants.js";
import { SCORE_THRESHOLDS } from "../constants/score.constants.js";
import { BudgetHelper } from "../helpers/budget.helper.js";
import { AreaHelper } from "../helpers/area.helper.js";
import { ConversationHelper } from "../helpers/conversation.helper.js";
import { ScoreHelper } from "../helpers/score.helper.js";
import { CollectedData } from "../types/conversation.types.js";
import { ScoreBreakdown } from "../types/lead.types.js";

type LeadDbClient = Prisma.TransactionClient | typeof prisma;

type ExistingLeadSnapshot = {
  status: LeadStatus;
  triggerType: string | null;
} | null;

type LeadWriteValues = {
  name: string;
  score: number;
  status: LeadStatus;
  productInterest: string;
  customerType: string;
  investmentRange: string;
  areaSqft: string;
  timeline: string;
  triggerType: string;
  showroomCity: string;
  wantsCallback: boolean;
  wantsSample: boolean;
  estimatedOrderValue: number;
};

const PURCHASE_INTENT_KEYWORDS = [
  "buy",
  "purchase",
  "visit",
  "showroom",
  "where to buy",
  "how to proceed",
  "order",
] as const;

export type PreparedLeadUpsert = {
  conversationId: string;
  collectedData: CollectedData;
  trigger: string | null;
  breakdown: ScoreBreakdown;
  leadValues: LeadWriteValues;
};

function toSafeString(value: unknown, fallback = "Not specified"): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

function detectNeedsFallback(userMessages: string[]) {
  const text = userMessages.join(" ").toLowerCase();
  return {
    wants_callback: /callback|call me|contact me|reach out|phone kar|baat kar/.test(text),
    wants_sample: /sample|touch|feel|see a sample|physical sample/.test(text),
  };
}

function sanitizeLeadFields(enrichedData: CollectedData) {
  const rawBudget = String(enrichedData.budget || "");
  const sanitizedInvestment = (VALID_BUDGETS as readonly string[]).includes(rawBudget)
    ? rawBudget
    : "Flexible";

  const rawArea = String(enrichedData.areaSqft || "");
  const sanitizedArea =
    rawArea && rawArea !== "undefined"
      ? (VALID_AREAS as readonly string[]).includes(rawArea)
        ? rawArea
        : rawArea.match(/^\d+$/)
          ? rawArea
          : "Not captured"
      : "Not captured";

  return { sanitizedInvestment, sanitizedArea };
}

export function calculateLeadScore(
  collectedData: CollectedData,
  userMessages: string[],
  recommendedProducts: Array<{ priceRange: string }>
): ScoreBreakdown {
  return ScoreHelper.calculate(collectedData, userMessages, recommendedProducts);
}

export function estimateOrderValue(collectedData: CollectedData): number {
  const areaRaw = toSafeString(collectedData.areaSqft, "Not specified");
  const budgetRaw = toSafeString(collectedData.budget, "Not specified");

  const areaVal = AreaHelper.getMidpoint(areaRaw);
  const budgetVal = BudgetHelper.getMidpoint(budgetRaw);

  const value = areaVal * budgetVal;
  return value > 0 ? value : areaVal * 200;
}

export function detectHandoverTrigger(
  input: string,
  collectedData: CollectedData,
  score: number
): string | null {
  const lowered = input.toLowerCase();
  const matched = HANDOVER_KEYWORDS.find((keyword) => lowered.includes(keyword));
  const hasPurchaseIntent = PURCHASE_INTENT_KEYWORDS.some((keyword) => lowered.includes(keyword));
  const hasCity = typeof collectedData.city === "string" && collectedData.city.trim().length > 0;

  if (matched) return matched;
  if (collectedData.wantsCallback) return "Callback Request";
  if (collectedData.wantsSample) return "Sample Request";
  if (hasPurchaseIntent && (hasCity || score >= SCORE_THRESHOLDS.HOT)) return "Purchase Intent";
  if (score >= SCORE_THRESHOLDS.HOT) return "Score >= 70";

  return null;
}

export function prepareLeadUpsert(params: {
  conversationId: string;
  customerName?: string | null;
  existingLead?: ExistingLeadSnapshot;
  collectedData: CollectedData;
  recommendedProducts: Array<{ priceRange: string }>;
  latestUserInput: string;
  userMessages: string[];
}): PreparedLeadUpsert | null {
  const cleanData = Object.fromEntries(
    Object.entries(params.collectedData).filter(([key]) => !key.startsWith("_"))
  ) as CollectedData;

  const conversationNeeds = detectNeedsFallback(params.userMessages);
  const enrichedData: CollectedData = {
    ...cleanData,
    wantsCallback: conversationNeeds.wants_callback || Boolean(cleanData.wantsCallback),
    wantsSample: conversationNeeds.wants_sample || Boolean(cleanData.wantsSample),
  };

  if (ConversationHelper.getCollectedUserFieldCount(enrichedData) < 3) {
    return null;
  }

  const breakdown = ScoreHelper.calculate(enrichedData, params.userMessages, params.recommendedProducts);
  const estimatedOrderValue = estimateOrderValue(enrichedData);
  const trigger = detectHandoverTrigger(params.latestUserInput, enrichedData, breakdown.total);
  const status = ScoreHelper.determineStatus(breakdown.total);
  const { sanitizedInvestment, sanitizedArea } = sanitizeLeadFields(enrichedData);

  const derivedTriggerLabel = ScoreHelper.determineTrigger(
    trigger,
    Boolean(enrichedData.wantsCallback),
    breakdown.total
  );
  const triggerLabel =
    params.existingLead?.status === LeadStatus.HOT && params.existingLead.triggerType
      ? params.existingLead.triggerType
      : derivedTriggerLabel;

  return {
    conversationId: params.conversationId,
    collectedData: enrichedData,
    trigger,
    breakdown,
    leadValues: {
      name: toSafeString(enrichedData.name, params.customerName ?? "Not specified"),
      score: breakdown.total,
      status,
      productInterest: toSafeString(enrichedData.productType),
      customerType: toSafeString(enrichedData.customerType, "Homeowner"),
      investmentRange: sanitizedInvestment,
      areaSqft: sanitizedArea,
      timeline: toSafeString(enrichedData.timeline),
      triggerType: triggerLabel,
      showroomCity: toSafeString(enrichedData.city),
      wantsCallback: Boolean(enrichedData.wantsCallback),
      wantsSample: Boolean(enrichedData.wantsSample),
      estimatedOrderValue,
    },
  };
}

export async function persistPreparedLead(params: {
  plan: PreparedLeadUpsert;
  tx?: LeadDbClient;
}) {
  const db = params.tx ?? prisma;
  const lead = await db.lead.upsert({
    where: { conversationId: params.plan.conversationId },
    update: params.plan.leadValues,
    create: {
      conversationId: params.plan.conversationId,
      ...params.plan.leadValues,
    },
  });

  await db.leadScore.upsert({
    where: { leadId: lead.id },
    update: params.plan.breakdown,
    create: { leadId: lead.id, ...params.plan.breakdown },
  });

  return {
    lead,
    breakdown: params.plan.breakdown,
    trigger: params.plan.trigger,
    collectedData: params.plan.collectedData,
  };
}

export async function getDashboardSnapshot(filter?: string) {
  const where: Prisma.LeadWhereInput =
    filter === "hot"
      ? { status: LeadStatus.HOT }
      : filter === "warm"
        ? { score: { gte: 40, lt: 70 } }
        : filter === "callback"
          ? { wantsCallback: true }
          : filter === "sample"
            ? { wantsSample: true }
            : {};

  const leads = await prisma.lead.findMany({
    where,
    include: { conversation: true, leadScore: true },
    orderBy: { updatedAt: "desc" },
  });

  const all = await prisma.lead.findMany();
  const triggerCounts = await prisma.lead.groupBy({
    by: ["triggerType"],
    _count: { triggerType: true },
    orderBy: { _count: { triggerType: "desc" } },
    take: 1,
    where: { triggerType: { not: null } },
  });
  const totalConversations = await prisma.conversation.count();
  const avgScore = all.length
    ? Math.round(all.reduce((sum, lead) => sum + lead.score, 0) / all.length)
    : 0;
  const mostCommonTrigger = triggerCounts[0]?.triggerType ?? "-";

  return {
    stats: {
      totalConversations,
      hotLeads: all.filter((lead) => lead.score >= SCORE_THRESHOLDS.HOT).length,
      warmLeads: all.filter((lead) => lead.score >= SCORE_THRESHOLDS.WARM && lead.score < SCORE_THRESHOLDS.HOT).length,
      avgScore,
      mostCommonTrigger,
    },
    leads,
  };
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      leadScore: true,
      conversation: {
        include: { messages: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}
