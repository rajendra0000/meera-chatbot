import assert from "node:assert/strict";
import test from "node:test";
import { ChatStep } from "@prisma/client";
import { mockCatalogLookups, runTurns, setDeterministicChatDeps } from "./helpers.js";

test("context: later room-type overrides replace only the intended field and preserve earlier state", async () => {
  mockCatalogLookups();
  setDeterministicChatDeps();

  const transcript = await runTurns({
    currentStep: ChatStep.NAME,
    collectedData: {},
    turns: [
      "My name is Arjun",
      "I want wall panels for my office in Pune, budget is around 300-400 per sqft",
      "Forget the office, it's actually for my living room",
    ],
  });

  assert.equal(transcript.state.currentStep, ChatStep.STYLE);
  assert.equal(transcript.state.collectedData.name, "Arjun");
  assert.equal(transcript.state.collectedData.productType, "Wall Panels (H-UHPC)");
  assert.equal(transcript.state.collectedData.city, "Pune");
  assert.match(String(transcript.state.collectedData.budget), /200-400/);
  assert.equal(transcript.state.collectedData.roomType, "Living Room");
});

test("context: product switches preserve compatible fields and trigger the budget guard when needed", async () => {
  mockCatalogLookups();
  setDeterministicChatDeps();

  const transcript = await runTurns({
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Arjun",
      productType: "Breeze Blocks",
      city: "Pune",
      budget: "â‚¹200-400/sqft",
      areaSqft: "500",
      roomType: "Garden",
      style: "Modern",
      timeline: "Just Exploring",
    },
    turns: ["Actually change to wall panels. Same budget."],
  });

  assert.equal(transcript.state.currentStep, ChatStep.COMPLETED);
  assert.equal(transcript.state.collectedData.productType, "Wall Panels (H-UHPC)");
  assert.equal(transcript.state.collectedData.city, "Pune");
  assert.equal(transcript.state.collectedData.areaSqft, "500");
  assert.match(transcript.last?.reply ?? "", /Breeze Blocks|Brick Cladding/i);
});
