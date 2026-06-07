import OpenAI from "openai";
import { getOpenAIConfig } from "../lib/openai";
import { chatAiEnabled } from "./config";

function client(): OpenAI | null {
  if (!chatAiEnabled()) return null;
  const { apiKey, baseURL } = getOpenAIConfig();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL });
}

export async function summarizeMessages(
  lines: { author: string; content: string; time?: string }[],
  context: string,
): Promise<string | null> {
  const openai = client();
  if (!openai || lines.length === 0) return null;

  const transcript = lines
    .map((l) => `[${l.time ?? ""}] ${l.author}: ${l.content}`)
    .join("\n")
    .slice(0, 12000);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Summarize the chat transcript into concise bullet points: key decisions, action items, and open questions. Use markdown bullets.",
      },
      { role: "user", content: `${context}\n\n${transcript}` },
    ],
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content?.trim() ?? null;
}

export async function answerJigantoQuery(question: string): Promise<string | null> {
  const openai = client();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are @jiganto, the Jiganto platform assistant in team chat. Answer briefly and helpfully about work, projects, and collaboration. If you lack data, say so clearly.",
      },
      { role: "user", content: question },
    ],
    max_tokens: 600,
  });

  return completion.choices[0]?.message?.content?.trim() ?? null;
}
