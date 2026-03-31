import assert from "node:assert/strict";
import test from "node:test";
import { ChatStep } from "@prisma/client";
import { mockCatalogLookups, recentProducts, runTurns, setDeterministicChatDeps } from "./helpers.js";

test("flow: repeating an already-collected product type does not create a loop", async () => {
  mockCatalogLookups();
  setDeterministicChatDeps();

  const transcript = await runTurns({
    currentStep: ChatStep.NAME,
    collectedData: {},
    turns: [
      "Priya",
      "wall panels",
      "wall panels",
    ],
  });

  assert.equal(transcript.results[1]?.nextStep, ChatStep.CITY);
  assert.equal(transcript.results[2]?.nextStep, ChatStep.CITY);
  assert.equal(transcript.state.currentStep, ChatStep.CITY);
  assert.equal(transcript.state.collectedData.productType, "Wall Panels (H-UHPC)");
});

test("flow: skip at a skippable step advances once and records the placeholder value", async () => {
  mockCatalogLookups();
  setDeterministicChatDeps();

  const transcript = await runTurns({
    currentStep: ChatStep.CITY,
    collectedData: {
      name: "Priya",
      productType: "Breeze Blocks",
    },
    turns: ["skip"],
  });

  assert.equal(transcript.state.currentStep, ChatStep.BUDGET);
  assert.equal(transcript.state.collectedData.city, "Unknown");
});

test("flow: reset requests after completion do not silently rewind or wipe collected state", async () => {
  mockCatalogLookups();
  setDeterministicChatDeps();

  const transcript = await runTurns({
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Priya",
      productType: "Wall Panels (H-UHPC)",
      city: "Mumbai",
      budget: "â‚¹400+/sqft",
      areaSqft: "300",
      roomType: "Living Room",
      style: "Modern",
      timeline: "1-3 Months",
    },
    turns: ["Start over, I want to change everything. reset"],
  });

  assert.equal(transcript.state.currentStep, ChatStep.COMPLETED);
  assert.equal(transcript.state.collectedData.city, "Mumbai");
  assert.match(transcript.last?.reply ?? "", /start a new chat|update any specific detail/i);
});

test("flow: style moves to timeline before recommendations are shown", async () => {
  mockCatalogLookups({ products: recentProducts });
  setDeterministicChatDeps();

  const transcript = await runTurns({
    currentStep: ChatStep.STYLE,
    collectedData: {
      name: "Priya",
      productType: "Wall Panels (H-UHPC)",
      city: "Udaipur",
      budget: "Flexible",
      areaSqft: "300",
      roomType: "Living Room",
    },
    turns: ["modern", "this month"],
  });

  assert.equal(transcript.results[0]?.nextStep, ChatStep.TIMELINE);
  assert.deepEqual(transcript.results[0]?.quickReplies, ["This Month", "1-3 Months", "3-6 Months", "Just Exploring"]);
  assert.equal(transcript.results[0]?.recommendProducts.length, 0);
  assert.equal(transcript.results[1]?.nextStep, ChatStep.COMPLETED);
  assert.equal(transcript.results[1]?.collectedData.timeline, "This Month");
  assert.ok((transcript.results[1]?.recommendProducts.length ?? 0) > 0);
});
