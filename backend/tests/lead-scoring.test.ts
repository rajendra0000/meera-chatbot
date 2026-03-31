import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus } from "@prisma/client";
import { ScoreHelper } from "../src/helpers/score.helper.js";
import { CollectedData } from "../src/types/conversation.types.js";

test("strong structured lead scores HOT even without budgetMode, areaMode, or timelineScore helpers", () => {
  const collectedData: CollectedData = {
    name: "Rohan",
    productType: "Brick Cladding",
    city: "Udaipur",
    budget: "₹200-400/sqft",
    areaSqft: "200",
    roomType: "Office",
    style: "Modern",
    timeline: "This Month",
  };

  const userMessages = [
    "My name is Rohan",
    "I want brick cladding",
    "I'm in Udaipur",
    "budget is 200-400 per sqft",
    "area is 200 sqft",
    "it's for my office and I want a modern look",
    "need it this month",
  ];

  const breakdown = ScoreHelper.calculate(collectedData, userMessages, []);

  assert.deepEqual(breakdown, {
    budget: 30,
    space: 20,
    productInterest: 15,
    timeline: 10,
    engagement: 21,
    total: 96,
  });
  assert.equal(ScoreHelper.determineStatus(breakdown.total), LeadStatus.HOT);
});

test("budget scoring is aligned to the chosen product category instead of a static default", () => {
  const brickLead = ScoreHelper.calculate(
    {
      productType: "Brick Cladding",
      budget: "₹200-400/sqft",
      areaSqft: "200",
      timeline: "1-3 Months",
    },
    ["brick cladding", "budget is 200-400", "area is 200 sqft"],
    []
  );

  const wallPanelLead = ScoreHelper.calculate(
    {
      productType: "Wall Panels (H-UHPC)",
      budget: "₹200-400/sqft",
      areaSqft: "200",
      timeline: "1-3 Months",
    },
    ["wall panels", "budget is 200-400", "area is 200 sqft"],
    []
  );

  assert.equal(brickLead.budget, 30);
  assert.equal(wallPanelLead.budget, 14);
  assert.ok(brickLead.total > wallPanelLead.total);
});

test("engagement score increases when the user asks for suggestions, images, and comparisons", () => {
  const collectedData: CollectedData = {
    name: "Rohan",
    productType: "Brick Cladding",
    city: "Udaipur",
    budget: "₹200-400/sqft",
    areaSqft: "200",
    roomType: "Office",
    style: "Modern",
    timeline: "This Month",
  };

  const baseline = ScoreHelper.calculate(collectedData, [
    "My name is Rohan",
    "I want brick cladding",
    "I'm in Udaipur",
    "budget is 200-400 per sqft",
    "area is 200 sqft",
    "it's for my office and I want a modern look",
    "need it this month",
  ], []);

  const boosted = ScoreHelper.calculate(collectedData, [
    "My name is Rohan",
    "I want brick cladding",
    "I'm in Udaipur",
    "budget is 200-400 per sqft",
    "area is 200 sqft",
    "it's for my office and I want a modern look",
    "need it this month",
    "show me some options",
    "please share more images and compare the top two",
  ], []);

  assert.equal(baseline.engagement, 21);
  assert.equal(boosted.engagement, 25);
  assert.ok(boosted.total > baseline.total);
});
