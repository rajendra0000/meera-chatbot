import { prisma } from "../lib/prisma.js";
import { groqJsonCompletion } from "../lib/groq.js";

/**
 * Method 1 — Keyword search (instant, no Groq needed).
 */
export async function searchFaqByKeywords(userMessage: string) {
  const normalized = userMessage.toLowerCase().replace(/[₹?!.,]/g, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(/\s+/).filter((w) => w.length > 3);

  if (!words.length) return [];

  const candidateTerms = Array.from(new Set([normalized, ...words])).filter((term) => term.length >= 3);
  const entries = await prisma.faqEntry.findMany({
    where: {
      OR: candidateTerms.flatMap((term) => ([
        { keywords: { contains: term } },
        { question: { contains: term } },
        { answer: { contains: term } }
      ]))
    }
  });

  if (!entries.length) return [];

  const results: Array<{ entry: (typeof entries)[0]; score: number; category: string; keywords: string }> = [];

  for (const entry of entries) {
    const entryKeywords = entry.keywords
      .toLowerCase()
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length >= 3);

    let score = 0;

    for (const kw of entryKeywords) {
      if (kw.length < 3) continue;
      if (normalized.includes(kw)) {
        score += kw.includes(" ") ? 5 : kw.length > 6 ? 4 : 2;
      }
    }

    for (const word of words) {
      if (word.length < 4) continue;
      if (entryKeywords.some((kw) => kw.includes(word))) {
        score += 1;
      }
      if (entry.question.toLowerCase().includes(word)) {
        score += 2;
      }
      if (entry.answer.toLowerCase().includes(word)) {
        score += 1;
      }
    }

    if (entry.question.toLowerCase().includes(normalized)) {
      score += 4;
    }
    if (entry.answer.toLowerCase().includes(normalized)) {
      score += 2;
    }

    if (score > 0) {
      results.push({ entry, score, category: entry.category.toLowerCase(), keywords: entry.keywords.toLowerCase() });
    }
  }

  const q = normalized;

  if (q.includes("install") || q.includes("lagana") || q.includes("lagwana") ||
      q.includes("fitting") || q.includes("labour") || q.includes("contractor")) {
    results.forEach((r) => {
      if (r.category === "installation") r.score += 25;
      if (r.category === "brand" || r.category === "company") r.score -= 20;
    });
  }
  if (q.includes("cost") || q.includes("price") || q.includes("rate") ||
      q.includes("kitna") || q.includes("charges") || q.includes("kharcha")) {
    results.forEach((r) => {
      if (r.category === "pricing") r.score += 20;
      if (r.category === "installation") r.score += 15;
      if (r.category === "brand" || r.category === "company") r.score -= 15;
    });
  }
  if (q.includes("deliver") || q.includes("ship") || q.includes("dispatch") ||
      q.includes("weeks") || q.includes("kitne din") || q.includes("kab milega")) {
    results.forEach((r) => {
      if (r.category === "delivery" || r.keywords.includes("shipping") || r.keywords.includes("delivery")) r.score += 25;
      if (r.category === "brand" || r.category === "company") r.score -= 10;
    });
  }
  if (q.includes("contact") || q.includes("phone") || q.includes("email") ||
      q.includes("number") || q.includes("reach")) {
    results.forEach((r) => {
      if (r.keywords.includes("contact") || r.keywords.includes("phone")) r.score += 20;
    });
  }
  if (q.includes("warrant") || q.includes("last") || q.includes("lifespan") ||
      q.includes("durable") || q.includes("kitne saal") || q.includes("guarantee")) {
    results.forEach((r) => {
      if (r.category === "product" || r.category === "products") r.score += 20;
      if (r.category === "brand" || r.category === "company") r.score -= 10;
    });
  }

  results.sort((a, b) => b.score - a.score);
  const qualifiedResults = results.filter((result) => result.score >= 5).slice(0, 3);

  if (!qualifiedResults.length) {
    return [];
  }
  return qualifiedResults.map((result) => result.entry);
}

/**
 * Method 2 — Groq semantic search (for complex/ambiguous questions).
 */
export async function searchFaqBySemantic(
  userMessage: string
): Promise<string | null> {
  const entries = await prisma.faqEntry.findMany({
    select: { question: true, answer: true, category: true },
  });

  if (!entries.length) {
    console.warn("[faq:semantic] No FAQ entries in DB");
    return null;
  }

  const faqJson = JSON.stringify(
    entries.map((e) => ({ q: e.question, a: e.answer, cat: e.category }))
  );

  const systemPrompt = `You are a FAQ lookup system for Hey Concrete, India's leading designer concrete surface brand.\nRespond in JSON only.`;

  const userPrompt = `User asked: "${userMessage}"

Search these FAQ entries and return the most relevant answer.
If no entry is relevant, return found: false.

FAQ entries:
${faqJson}

Respond in JSON only:
{
  "found": true/false,
  "answer": "the exact answer from the FAQ or null",
  "category": "category name or null"
}`;

  try {
    const completion = await groqJsonCompletion(systemPrompt, userPrompt);
    if (!completion) {
      console.warn("[faq:semantic] Groq returned null");
      return null;
    }

    const parsed = JSON.parse(completion);
    if (!parsed.found || !parsed.answer) {
      return null;
    }
    return String(parsed.answer);
  } catch (err) {
    console.error("[faq:semantic] Parse error:", err);
    return null;
  }
}

/**
 * Combined search — keyword first (instant), then short-query catch-all,
 * then semantic Groq only for longer complex queries.
 */
export async function findAnswer(
  userMessage: string
): Promise<string | null> {
  const keywordMatches = await searchFaqByKeywords(userMessage);
  if (keywordMatches.length) {
    return keywordMatches[0].answer;
  }

  const wordCount = userMessage.trim().split(/\s+/).length;
  if (wordCount <= 3) {
    return null;
  }

  const semanticAnswer = await searchFaqBySemantic(userMessage);
  return semanticAnswer ?? null;
}
