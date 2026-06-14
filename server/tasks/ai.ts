import OpenAI from "openai";
import { getOpenAIConfig, isOpenAIConfigured } from "../lib/openai";
import type { AggregatedTask } from "@shared/models/tasks";
import { listAggregatedTasks, type TaskScope } from "./service";

export async function prioritizeTasks(scope: TaskScope): Promise<{ orderedIds: string[]; rationale: string }> {
  const tasks = await listAggregatedTasks(scope, {});
  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  if (!isOpenAIConfigured()) {
    const ordered = [...open].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      const pri = { high: 0, medium: 1, low: 2 };
      const pd = pri[a.priority] - pri[b.priority];
      if (pd !== 0) return pd;
      return String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999"));
    });
    return {
      orderedIds: ordered.map((t) => t.id),
      rationale: "Sorted by overdue status, priority, and due date (AI unavailable).",
    };
  }
  const { apiKey, baseURL } = getOpenAIConfig();
  const openai = new OpenAI({ apiKey: apiKey!, baseURL });
  const summary = open.map((t) => ({
    id: t.id,
    title: t.title,
    source: t.source,
    priority: t.priority,
    dueDate: t.dueDate,
    overdue: t.isOverdue,
    project: t.projectName,
  }));
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You prioritise a consultant's task list for today. Return JSON { orderedIds: string[], rationale: string } using only provided task ids.",
      },
      { role: "user", content: JSON.stringify(summary) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { orderedIds?: string[]; rationale?: string };
  return {
    orderedIds: parsed.orderedIds ?? open.map((t) => t.id),
    rationale: parsed.rationale ?? "AI prioritisation complete.",
  };
}

export async function summariseWeek(scope: TaskScope): Promise<{ summary: string; completed: number; outstanding: number }> {
  const tasks = await listAggregatedTasks(scope, {});
  const completed = tasks.filter((t) => t.status === "completed").length;
  const outstanding = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length;
  if (!isOpenAIConfigured()) {
    return {
      summary: `You completed ${completed} task(s) and have ${outstanding} still open across all sources.`,
      completed,
      outstanding,
    };
  }
  const { apiKey, baseURL } = getOpenAIConfig();
  const openai = new OpenAI({ apiKey: apiKey!, baseURL });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Write a brief weekly task summary (3-5 sentences) for a personal review. Be specific and actionable.",
      },
      {
        role: "user",
        content: JSON.stringify(
          tasks.map((t) => ({
            title: t.title,
            status: t.status,
            source: t.source,
            dueDate: t.dueDate,
            project: t.projectName,
          })),
        ),
      },
    ],
  });
  return {
    summary: completion.choices[0]?.message?.content ?? `Completed ${completed}, outstanding ${outstanding}.`,
    completed,
    outstanding,
  };
}

export async function createTasksFromText(
  scope: TaskScope,
  text: string,
): Promise<{ created: AggregatedTask[]; parsed: { title: string; dueDate?: string; source?: string }[] }> {
  let parsed: { title: string; dueDate?: string; source?: string; priority?: string }[] = [];
  if (isOpenAIConfigured()) {
    const { apiKey, baseURL } = getOpenAIConfig();
    const openai = new OpenAI({ apiKey: apiKey!, baseURL });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Extract action items from meeting notes. Return JSON { items: [{ title, dueDate?, source?, priority? }] } where source is one of personal, team, project, meeting.',
        },
        { role: "user", content: text },
      ],
    });
    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      items?: { title: string; dueDate?: string; source?: string; priority?: string }[];
    };
    parsed = raw.items ?? [];
  } else {
    parsed = text
      .split(/\n/)
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .map((title) => ({ title }));
  }

  const { createPersonalTask, listAggregatedTasks: list } = await import("./service");
  for (const item of parsed) {
    await createPersonalTask(scope, {
      title: item.title,
      dueDate: item.dueDate,
      source: (item.source as any) ?? "meeting",
      priority: (item.priority as any) ?? "medium",
      isPersonal: item.source === "personal",
    });
  }
  const created = await list(scope, {});
  return { created, parsed };
}
