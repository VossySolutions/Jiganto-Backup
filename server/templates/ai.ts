import { db } from "../db";
import { platformTemplates, templateAiGenerations } from "@shared/models/templates";
import type { TemplateModule } from "@shared/models/templates";

const AI_MODULES: TemplateModule[] = [
  "bpm_framework", "bpm_diagram", "bpm_orgchart", "survey", "project", "bpml", "esign",
  "workspace", "whiteboard", "test_mgmt",
];

export async function generateTemplateWithAi(params: {
  tenantId: number;
  userId: string;
  userName?: string;
  module: TemplateModule;
  prompt: string;
  categoryTags?: string[];
}) {
  if (!AI_MODULES.includes(params.module)) {
    throw new Error(`AI generation not supported for module: ${params.module}`);
  }

  const { checkAiTokenAllowance, recordAiTokenUsage } = await import("../lib/ai-tokens");
  const check = await checkAiTokenAllowance({
    orgId: params.tenantId, userId: params.userId, module: "templates", estimatedTokens: 1200,
  });
  if (!check.allowed) throw new Error(check.reason ?? "Insufficient AI tokens");

  const { getOpenAIConfig } = await import("../lib/openai");
  const { apiKey, baseURL } = getOpenAIConfig();
  if (!apiKey) throw new Error("AI not configured");

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey, baseURL });

  const modulePrompts: Record<string, string> = {
    bpm_framework: `Generate a methodology framework JSON for: "${params.prompt}"
Return JSON: { "name", "description", "category", "vendor", "phases": [{ "order", "name", "description", "rows": [] }] }`,
    bpm_diagram: `Generate a BPM process diagram template JSON for: "${params.prompt}"
Return JSON: { "name", "description", "type", "nodes": [{ "nodeId", "nodeType", "label", "positionX", "positionY" }], "edges": [{ "edgeId", "sourceNodeId", "targetNodeId", "label" }] }`,
    bpm_orgchart: `Generate an org chart template JSON for: "${params.prompt}"
Return JSON: { "name", "description", "chartTitle", "chartType", "members": [{ "name", "title", "department", "_origId", "parentMemberId", "sortOrder" }] }`,
    survey: `Generate a survey template JSON for: "${params.prompt}"
Return JSON: { "title", "description", "surveyType", "category", "questions": [{ "text", "type", "options", "required", "scaleMin", "scaleMax" }] }`,
    project: `Generate a project setup template JSON for: "${params.prompt}"
Return JSON: { "name", "description", "projectType", "methodology", "framework", "tools": [{ "toolType", "toolCategory", "label" }], "workstreamNames": [] }`,
    bpml: `Generate a BPML process list template JSON for: "${params.prompt}"
Return JSON: { "name", "description", "erpPlatform", "processArea", "entries": [{ "processName", "processCode", "businessArea", "moduleArea" }] }`,
    esign: `Generate an eSign document template JSON for: "${params.prompt}"
Return JSON: { "title", "description", "category", "contentHtml" }`,
    workspace: `Generate a workspace template JSON for: "${params.prompt}"
Return JSON: { "name", "description", "icon", "color", "pages": [{ "title", "pageType", "content", "databases": [{ "name", "activeView", "columns": [{ "name", "type", "sortOrder" }] }] }] }`,
    whiteboard: `Generate a whiteboard layout template JSON for: "${params.prompt}"
Return JSON: { "name", "description", "notes": [{ "noteType", "colourHex", "xPosition", "yPosition", "width", "height" }] }`,
    test_mgmt: `Generate a test management hierarchy template JSON for: "${params.prompt}"
Return JSON: { "hierarchy": { "areas": [{ "name", "description" }], "processes": [{ "areaIndex", "name", "priority" }], "scenarios": [{ "processIndex", "name" }], "testCases": [{ "scenarioIndex", "title", "steps": [{ "stepOrder", "action", "expectedResult" }] }] } }`,
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: modulePrompts[params.module] }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const tokens = completion.usage?.total_tokens ?? 800;

  await recordAiTokenUsage({
    orgId: params.tenantId, userId: params.userId, module: "templates",
    featureName: `template_ai_${params.module}`, tokensConsumed: tokens,
  });

  const name = String(parsed.name ?? parsed.title ?? "AI Template");
  const description = String(parsed.description ?? params.prompt.slice(0, 200));

  let snapshot: Record<string, unknown>;
  if (params.module === "survey") {
    snapshot = {
      title: parsed.title ?? name, description, surveyType: parsed.surveyType,
      category: parsed.category, questionsJson: parsed.questions ?? [],
      settingsJson: { anonymous: false, showProgress: true, onePerPage: true },
    };
  } else if (params.module === "esign") {
    snapshot = {
      title: parsed.title ?? name, description, category: parsed.category ?? "Custom",
      sourceType: "inline_doc", contentHtml: parsed.contentHtml ?? `<h1>${name}</h1><p>${description}</p>`,
    };
  } else if (params.module === "test_mgmt") {
    snapshot = { hierarchy: parsed.hierarchy ?? parsed };
  } else {
    snapshot = parsed;
  }

  const [tpl] = await db.insert(platformTemplates).values({
    tenantId: params.tenantId,
    name,
    description,
    module: params.module,
    categoryTags: params.categoryTags ?? ["Custom"],
    tier: "customer",
    snapshotJsonb: snapshot,
    status: "draft",
    isAiGenerated: true,
    createdBy: params.userId,
    createdByName: params.userName,
  }).returning();

  await db.insert(templateAiGenerations).values({
    templateId: tpl.id,
    promptText: params.prompt,
    modelUsed: "gpt-4o",
    tokensConsumed: tokens,
    generatedBy: params.userId,
  });

  return tpl;
}
