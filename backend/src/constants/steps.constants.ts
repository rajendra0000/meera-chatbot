import { ChatStep } from "@prisma/client";

export const STEP_ORDER: ChatStep[] = [
  ChatStep.NAME,
  ChatStep.PRODUCT_TYPE,
  ChatStep.CITY,
  ChatStep.BUDGET,
  ChatStep.AREA,
  ChatStep.ROOM_TYPE,
  ChatStep.STYLE,
  ChatStep.TIMELINE,
  ChatStep.COMPLETED,
];

export const QUICK_REPLIES: Record<string, string[]> = {
  PRODUCT_TYPE: ["Wall Panels", "Breeze Blocks", "Brick Cladding", "Wall Murals"],
  CITY: ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Chennai", "Udaipur", "Other"],
  BUDGET: ["Under ₹200/sqft", "₹200-400/sqft", "₹400+/sqft", "Flexible"],
  AREA: ["small", "medium", "large"],
  ROOM_TYPE: ["Living Room", "Bedroom", "Office", "Facade", "Outdoor", "Commercial"],
  STYLE: ["Minimal", "Modern", "Geometric", "Statement", "Textured"],
  TIMELINE: ["This Month", "1-3 Months", "3-6 Months", "Just Exploring"],
};

export const STEP_PROMPTS: Record<string, string> = {
  NAME: "What should I call you?",
  PRODUCT_TYPE: "What are you exploring today: wall panels, wall murals, breeze blocks, or brick cladding?",
  CITY: "Could you tell me which city this project is in?",
  BUDGET: "What budget range are you considering? A rough range is fine.",
  AREA: "About how much area would you like to cover?",
  ROOM_TYPE: "Which room or space is this for?",
  STYLE: "What kind of look do you have in mind: minimal, modern, geometric, textured, or statement?",
  TIMELINE: "When are you hoping to start: This Month, 1-3 Months, 3-6 Months, or Just Exploring?",
};

export const REQUIRED_FIELDS: Array<[string, ChatStep]> = [
  ["name", ChatStep.NAME],
  ["productType", ChatStep.PRODUCT_TYPE],
  ["city", ChatStep.CITY],
  ["budget", ChatStep.BUDGET],
  ["areaSqft", ChatStep.AREA],
  ["roomType", ChatStep.ROOM_TYPE],
  ["style", ChatStep.STYLE],
  ["timeline", ChatStep.TIMELINE],
];
