import OpenAI from "openai";
import { getOpenAIConfig } from "./openai";

export type AiInsightItem = {
  type: "anomaly" | "risk" | "recommendation" | "positive";
  severity: "high" | "medium" | "low" | "info";
  title: string;
  description: string;
};

export type AiInsightsResult = {
  insights: AiInsightItem[];
  summary: Record<string, unknown>;
  generatedAt: string;
  source: "ai" | "rules";
};

export async function generateAiInsights(opts: {
  summary: Record<string, unknown>;
  systemPrompt: string;
  rulesFallback: () => AiInsightItem[];
}): Promise<AiInsightsResult> {
  const generatedAt = new Date().toISOString();
  const { apiKey, baseURL } = getOpenAIConfig();

  if (!apiKey) {
    return {
      insights: opts.rulesFallback(),
      summary: opts.summary,
      generatedAt,
      source: "rules",
    };
  }

  try {
    const openai = new OpenAI({ apiKey, baseURL });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.systemPrompt },
        {
          role: "user",
          content: `Analyse this data and return insights:\n${JSON.stringify(opts.summary, null, 2)}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    const parsed = raw ? JSON.parse(raw) : { insights: [] };
    const insights = Array.isArray(parsed.insights) ? parsed.insights : [];
    if (insights.length === 0) {
      return {
        insights: opts.rulesFallback(),
        summary: opts.summary,
        generatedAt,
        source: "rules",
      };
    }
    return { insights, summary: opts.summary, generatedAt, source: "ai" };
  } catch {
    return {
      insights: opts.rulesFallback(),
      summary: opts.summary,
      generatedAt,
      source: "rules",
    };
  }
}

export const AI_INSIGHTS_SYSTEM_PROMPT = `You are a Jiganto enterprise advisor. Return JSON only:
{ "insights": [{ "type": "anomaly"|"risk"|"recommendation"|"positive", "severity": "high"|"medium"|"low"|"info", "title": string, "description": string }] }
Be specific, actionable, and reference the data. Return 4-6 insights max.`;
