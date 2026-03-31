import assert from "node:assert/strict";
import test from "node:test";
import { ChatStep } from "@prisma/client";
import { ConversationHelper } from "./conversation.helper.js";

test("getMissingRequiredStep treats filler stored values as missing", () => {
  const missingStep = ConversationHelper.getMissingRequiredStep({
    name: "Aman",
    productType: "Wall Panels",
    city: "Delhi",
    budget: "Flexible",
    areaSqft: "250",
    roomType: "Living Room",
    style: "okay",
    timeline: "This Month",
  });

  assert.equal(missingStep, ChatStep.STYLE);
});

test("getMissingRequiredStep returns null for a valid collected flow", () => {
  const missingStep = ConversationHelper.getMissingRequiredStep({
    name: "Aman",
    productType: "Wall Panels",
    city: "Delhi",
    budget: "Flexible",
    areaSqft: "250",
    roomType: "Living Room",
    style: "Minimal",
    timeline: "This Month",
  });

  assert.equal(missingStep, null);
});
