export const VALID_BUDGETS = [
  "Under ₹200/sqft",
  "₹200-400/sqft",
  "₹400+/sqft",
  "Flexible"
] as const;

export const BUDGET_SIZE_WORDS = [
  "chota", "chhota", "bada", "large", "small", "medium", "sqft",
  "sq ft", "feet", "meter", "room", "wall", "toilet", "bathroom",
  "bedroom", "office", "lobby", "hall", "kamra", "jagah", "chhoti"
];

export const BUDGET_VAGUE_WORDS = [
  "pta ni", "pata nahi", "pata ni", "idk", "not sure",
  "dont know", "don't know", "nahi pata", "nhi pta",
  "flexible", "koi bhi", "any", "whatever", "soch lunga",
  "decide later", "baad mein", "abhi nahi socha", "nahi socha",
  "samajh nahi", "pata nhi", "budget nahi", "no idea"
];

export const BUDGET_MIDPOINTS: Record<string, number> = {
  "Under ₹200/sqft": 150,
  "₹200-400/sqft": 300,
  "₹400+/sqft": 600,
  Flexible: 250,
  "Not specified": 200,
  "Not captured": 200,
  "₹200-400": 300,
  "₹400+": 450
};
