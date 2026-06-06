import OpenAI from "openai";
import { getOpenAIConfig } from "../lib/openai";
import { DASHBOARD_WIDGET_CATALOG } from "@shared/models/dashboard";
import type { DashboardLayout } from "@shared/models/dashboard";
import { createBespokeDashboard, addWidget } from "./bespoke";
import type { DashboardScope } from "./metrics";

const LAYOUT_BY_PROMPT: Record<string, DashboardLayout> = {
  executive: "2-col",
  dense: "3-col",
  focus: "1-col",
};

export async function generateAiDashboard(
  scope: DashboardScope,
  prompt: string,
): Promise<{ dashboardId: number; name: string; widgetsAdded: number } | { error: string }> {
  const { apiKey, baseURL } = getOpenAIConfig();
  if (!apiKey) {
    return { error: "OpenAI is not configured. Set OPENAI_API_KEY." };
  }

  const openai = new OpenAI({ apiKey, baseURL });
  const catalogSummary = DASHBOARD_WIDGET_CATALOG.map(
    (w) => `${w.type} (${w.module}): ${w.name}`,
  ).join("\n");

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You build Jiganto dashboard layouts. Return JSON: { "name": string, "layout": "1-col"|"2-col"|"3-col", "widgets": [{ "type": string, "module": string }] }. Pick 3-6 widgets from:\n${catalogSummary}`,
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { error: "AI returned no content." };

  let parsed: {
    name?: string;
    layout?: DashboardLayout;
    widgets?: { type: string; module?: string }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "AI response was not valid JSON." };
  }

  const name = parsed.name?.trim() || "AI Dashboard";
  const layout = parsed.layout ?? LAYOUT_BY_PROMPT.executive;
  const created = await createBespokeDashboard(scope, { name, description: `AI: ${prompt.slice(0, 120)}`, layout });
  if (!created) return { error: "Failed to create dashboard." };

  let y = 0;
  let widgetsAdded = 0;
  for (const w of parsed.widgets ?? []) {
    const catalog = DASHBOARD_WIDGET_CATALOG.find((c) => c.type === w.type);
    if (!catalog) continue;
    await addWidget(created.id, scope, {
      widgetType: catalog.type,
      widgetModule: catalog.module,
      positionX: (widgetsAdded % 2) * 2,
      positionY: y,
      width: catalog.defaultWidth,
      height: catalog.defaultHeight,
    });
    widgetsAdded++;
    if (widgetsAdded % 2 === 0) y += 2;
  }

  return { dashboardId: created.id, name, widgetsAdded };
}
