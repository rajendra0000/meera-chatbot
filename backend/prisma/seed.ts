import { PrismaClient, ConversationChannel, ConversationStatus, ChatStep, LeadStatus, MessageRole, PromptType } from "@prisma/client";
import { pathToFileURL } from "url";
import { seedProducts } from "./products.seed.js";
import { seedFaqEntries } from "./faq.seed.js";
import { seedShowrooms } from "./showrooms.seed.js";
import { SYSTEM_PROMPT_CONTENT } from "../src/services/prompt.service.js";

const prisma = new PrismaClient();

const learningPrompt = `Current learning:
- Prefer "Kyo nahi" over flat "Sure" when saying yes.
- Keep product suggestions grounded and elegant, never pushy.
- If a lead sounds ready, gently offer Kabir or showroom help.`;

export async function seedAll() {
  await seedProducts(prisma);
  await seedFaqEntries(prisma);
  await seedShowrooms(prisma);

  const defaults = [
    { type: PromptType.SYSTEM, content: SYSTEM_PROMPT_CONTENT, versionNumber: 1, isActive: true },
    { type: PromptType.LEARNING, content: learningPrompt, versionNumber: 1, isActive: true }
  ];

  for (const prompt of defaults) {
    const existing = await prisma.promptVersion.findFirst({
      where: { type: prompt.type, versionNumber: prompt.versionNumber }
    });

    if (!existing) {
      await prisma.promptVersion.create({ data: prompt });
    }
  }

  const demos = [
    {
      conversationId: "demo-aakanksha",
      name: "Aakanksha Mehta",
      score: 97,
      status: LeadStatus.HOT,
      productInterest: "Wall Panels (H-UHPC)",
      customerType: "Homeowner",
      investmentRange: "₹400+",
      areaSqft: "320",
      timeline: "This Month",
      triggerType: "Score >=70",
      showroomCity: "Delhi",
      wantsCallback: true,
      wantsSample: true,
      estimatedOrderValue: 144000,
      breakdown: { budget: 30, space: 20, productInterest: 15, timeline: 10, engagement: 22 }
    },
    {
      conversationId: "demo-priya",
      name: "Priya Sharma",
      score: 89,
      status: LeadStatus.HOT,
      productInterest: "Wall Murals",
      customerType: "Interior Designer",
      investmentRange: "₹400+",
      areaSqft: "210",
      timeline: "1-3 Months",
      triggerType: "Callback Request",
      showroomCity: "Bengaluru",
      wantsCallback: true,
      wantsSample: false,
      estimatedOrderValue: 94500,
      breakdown: { budget: 28, space: 20, productInterest: 15, timeline: 8, engagement: 18 }
    },
    {
      conversationId: "demo-rohan",
      name: "Rohan Gupta",
      score: 77,
      status: LeadStatus.HOT,
      productInterest: "Brick Cladding",
      customerType: "Architect",
      investmentRange: "₹200-400",
      areaSqft: "560",
      timeline: "3-6 Months",
      triggerType: "Showroom Visit",
      showroomCity: "Hyderabad",
      wantsCallback: false,
      wantsSample: true,
      estimatedOrderValue: 168000,
      breakdown: { budget: 24, space: 20, productInterest: 15, timeline: 6, engagement: 12 }
    }
  ];

  for (const demo of demos) {
    await prisma.conversation.upsert({
      where: { id: demo.conversationId },
      update: {
        customerName: demo.name,
        channel: ConversationChannel.WEB,
        status: ConversationStatus.HANDOVER,
        step: ChatStep.COMPLETED,
        collectedData: {
          name: demo.name,
          productType: demo.productInterest,
          city: demo.showroomCity,
          budget: demo.investmentRange,
          budgetMode: "known",
          areaSqft: demo.areaSqft,
          areaMode: "known",
          roomType: "Living Room",
          style: "Statement",
          timeline: demo.timeline,
          timelineScore: demo.breakdown.timeline,
          wantsCallback: demo.wantsCallback,
          wantsSample: demo.wantsSample
        }
      },
      create: {
        id: demo.conversationId,
        customerName: demo.name,
        channel: ConversationChannel.WEB,
        status: ConversationStatus.HANDOVER,
        step: ChatStep.COMPLETED,
        collectedData: {
          name: demo.name,
          productType: demo.productInterest,
          city: demo.showroomCity,
          budget: demo.investmentRange,
          budgetMode: "known",
          areaSqft: demo.areaSqft,
          areaMode: "known",
          roomType: "Living Room",
          style: "Statement",
          timeline: demo.timeline,
          timelineScore: demo.breakdown.timeline,
          wantsCallback: demo.wantsCallback,
          wantsSample: demo.wantsSample
        }
      }
    });

    const existingMessages = await prisma.message.count({ where: { conversationId: demo.conversationId } });
    if (!existingMessages) {
      await prisma.message.createMany({
        data: [
          { conversationId: demo.conversationId, role: MessageRole.USER, content: `Hi, I'm ${demo.name} and I'm exploring ${demo.productInterest}.` },
          { conversationId: demo.conversationId, role: MessageRole.ASSISTANT, content: "Namaste! Lovely choice ✨ I can help with budget, styles, and nearby showroom support." },
          { conversationId: demo.conversationId, role: MessageRole.USER, content: `Budget ${demo.investmentRange}, area ${demo.areaSqft} sqft, timeline ${demo.timeline}.` },
          { conversationId: demo.conversationId, role: MessageRole.ASSISTANT, content: "Wonderful investment ✨ I am connecting you to Kabir for the next step." }
        ]
      });
    }

    const lead = await prisma.lead.upsert({
      where: { conversationId: demo.conversationId },
      update: {
        name: demo.name,
        score: demo.score,
        status: demo.status,
        productInterest: demo.productInterest,
        customerType: demo.customerType,
        investmentRange: demo.investmentRange,
        areaSqft: demo.areaSqft,
        timeline: demo.timeline,
        triggerType: demo.triggerType,
        showroomCity: demo.showroomCity,
        wantsCallback: demo.wantsCallback,
        wantsSample: demo.wantsSample,
        estimatedOrderValue: demo.estimatedOrderValue
      },
      create: {
        conversationId: demo.conversationId,
        name: demo.name,
        score: demo.score,
        status: demo.status,
        productInterest: demo.productInterest,
        customerType: demo.customerType,
        investmentRange: demo.investmentRange,
        areaSqft: demo.areaSqft,
        timeline: demo.timeline,
        triggerType: demo.triggerType,
        showroomCity: demo.showroomCity,
        wantsCallback: demo.wantsCallback,
        wantsSample: demo.wantsSample,
        estimatedOrderValue: demo.estimatedOrderValue
      }
    });

    await prisma.leadScore.upsert({
      where: { leadId: lead.id },
      update: { ...demo.breakdown, total: demo.score },
      create: { leadId: lead.id, ...demo.breakdown, total: demo.score }
    });
  }
}

async function main() {
  await seedAll();
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entryUrl) {
  main()
    .then(async () => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
