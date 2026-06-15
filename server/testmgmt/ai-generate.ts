import type { TmScenario } from "@shared/models/testmgmt";

export type GeneratedTestCase = {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  steps: Array<{ stepOrder: number; action: string; expectedResult: string }>;
};

export type AiGenerateResult = {
  testCases: GeneratedTestCase[];
  source: "ai" | "fallback";
};

function fallbackTests(scenario: TmScenario, count: number): GeneratedTestCase[] {
  const base = scenario.title || scenario.scenarioId || "User story";
  return Array.from({ length: Math.min(count, 5) }, (_, i) => ({
    title: `${base} — Test ${i + 1}`,
    description: `Verify acceptance criteria for: ${scenario.description ?? base}`,
    priority: (["high", "medium", "medium", "low", "low"] as const)[i] ?? "medium",
    steps: [
      { stepOrder: 1, action: "Navigate to the feature entry point", expectedResult: "Feature is accessible with correct permissions" },
      { stepOrder: 2, action: `Execute primary flow for: ${base}`, expectedResult: "System behaves per acceptance criteria" },
      { stepOrder: 3, action: "Validate data persistence and UI feedback", expectedResult: "Changes saved; confirmation shown" },
    ],
  }));
}

export async function generateTestsForScenario(
  scenario: TmScenario,
  options: { count?: number; methodology?: string | null } = {},
): Promise<AiGenerateResult> {
  const count = Math.min(Math.max(options.count ?? 3, 1), 8);
  const labels = options.methodology === "agile"
    ? { item: "user story", child: "test case" }
    : { item: "scenario", child: "test case" };

  const { getOpenAIConfig } = await import("../lib/openai");
  const { apiKey, baseURL } = getOpenAIConfig();
  if (!apiKey) {
    return { testCases: fallbackTests(scenario, count), source: "fallback" };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey, baseURL });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a QA test designer for ERP/agile projects. Generate ${count} detailed ${labels.child}s for a ${labels.item}.
Return JSON: { "testCases": [{ "title": string, "description": string, "priority": "critical"|"high"|"medium"|"low", "steps": [{ "stepOrder": number, "action": string, "expectedResult": string }] }] }
Each test case should have 3-6 steps. Cover happy path, validation, and edge cases. Be specific to the domain.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            scenarioId: scenario.scenarioId,
            title: scenario.title,
            description: scenario.description,
            functionalArea: scenario.functionalArea,
            process: scenario.process,
            priority: scenario.priority,
            count,
          }, null, 2),
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    const parsed = raw ? JSON.parse(raw) : { testCases: [] };
    const cases = (parsed.testCases ?? []) as GeneratedTestCase[];
    if (!cases.length) return { testCases: fallbackTests(scenario, count), source: "fallback" };
    return {
      testCases: cases.slice(0, count).map((tc, idx) => ({
        title: tc.title || `${scenario.title} — Test ${idx + 1}`,
        description: tc.description ?? "",
        priority: (["critical", "high", "medium", "low"].includes(tc.priority) ? tc.priority : "medium") as GeneratedTestCase["priority"],
        steps: (tc.steps ?? []).map((s, si) => ({
          stepOrder: s.stepOrder ?? si + 1,
          action: s.action ?? "",
          expectedResult: s.expectedResult ?? "",
        })),
      })),
      source: "ai",
    };
  } catch {
    return { testCases: fallbackTests(scenario, count), source: "fallback" };
  }
}
