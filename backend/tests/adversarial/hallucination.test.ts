import assert from "node:assert/strict";
import test from "node:test";
import { ChatStep } from "@prisma/client";
import { processMessage } from "../../src/services/chat.service.js";
import { mockCatalogLookups, recentProducts, runTurns, setDeterministicChatDeps } from "./helpers.js";

const completedLead = {
  name: "Aman",
  productType: "Wall Panels (H-UHPC)",
  city: "Delhi",
  budget: "â‚¹400+/sqft",
  areaSqft: "500",
  roomType: "Living Room",
  style: "Modern",
  timeline: "1-3 Months",
};

test("hallucination: fake products are not recommended or treated as real catalog items", async () => {
  mockCatalogLookups({ products: recentProducts });
  setDeterministicChatDeps();

  const result = await processMessage({
    message: "Do you have a product called ConcreteLux Pro with silver finish? I saw it on your website.",
    currentStep: ChatStep.COMPLETED,
    collectedData: completedLead,
    history: ["ASSISTANT: Here are a few designs I'd shortlist for you."],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.COMPLETED);
  assert.equal(result.recommendProducts.length, 0);
  assert.doesNotMatch(result.reply, /ConcreteLux Pro is available|silver finish/i);
});

test("hallucination: exact final quote requests stay guarded and do not fabricate totals", async () => {
  mockCatalogLookups({ products: recentProducts });
  setDeterministicChatDeps();

  const result = await processMessage({
    message: "What's the exact price of the Serene panel for 500 sqft? Give me a final quote.",
    currentStep: ChatStep.COMPLETED,
    collectedData: completedLead,
    history: ["ASSISTANT: Here are a few designs I'd shortlist for you."],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.COMPLETED);
  assert.match(result.reply, /rough range/i);
  assert.match(result.reply, /formal quote|team/i);
  assert.doesNotMatch(result.reply, /₹\s*\d[\d,]*\s*$/m);
});

test("hallucination: chained follow-ups on a fabricated product remain non-committal across turns", async () => {
  mockCatalogLookups({ products: recentProducts });
  setDeterministicChatDeps();

  const transcript = await runTurns({
    currentStep: ChatStep.COMPLETED,
    collectedData: completedLead,
    history: ["ASSISTANT: Here are a few designs I'd shortlist for you."],
    turns: [
      "Tell me about the Hey Concrete Fusion panel",
      "How much does it cost per sqft?",
    ],
  });

  assert.equal(transcript.state.currentStep, ChatStep.COMPLETED);
  assert.doesNotMatch(transcript.results[0]?.reply ?? "", /Fusion panel is/i);
  assert.ok((transcript.results[0]?.recommendProducts ?? []).every((product) => recentProducts.some((candidate) => candidate.id === product.id)));
  assert.ok((transcript.results[1]?.recommendProducts ?? []).every((product) => recentProducts.some((candidate) => candidate.id === product.id)));
  assert.match(transcript.results[1]?.reply ?? "", /rough range|product guidance|pricing ranges/i);
});
