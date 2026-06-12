import OpenAI from "openai";
import { getOpenAIConfig } from "../lib/openai";

export async function generate360ExecutiveNarrative(context: {
  projectName: string;
  client: string | null;
  pm: string | null;
  overallRag: string | null;
  progress: number;
  status: string | null;
  openRisks: number;
  openIssues: number;
  overdueMilestones: number;
  budgetUsedPct: number;
}): Promise<{ narrative: string; source: "ai" | "template" }> {
  const template = `${context.projectName} is currently ${context.status || "active"} with overall RAG ${context.overallRag || "green"}. Progress stands at ${context.progress}%. ${context.openRisks} open risks and ${context.openIssues} open issues are tracked; ${context.overdueMilestones} milestone(s) are overdue. Budget consumption is at ${context.budgetUsedPct}% of plan.`;

  const { apiKey, baseURL } = getOpenAIConfig();
  if (!apiKey) return { narrative: template, source: "template" };

  try {
    const openai = new OpenAI({ apiKey, baseURL });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a PMO advisor drafting an executive status narrative for a 360° project report. Write 2-3 concise professional sentences suitable for a steering committee. Be factual, reference RAG and delivery signals. No bullet points.",
        },
        {
          role: "user",
          content: JSON.stringify(context),
        },
      ],
      max_tokens: 220,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { narrative: template, source: "template" };
    return { narrative: text, source: "ai" };
  } catch {
    return { narrative: template, source: "template" };
  }
}
