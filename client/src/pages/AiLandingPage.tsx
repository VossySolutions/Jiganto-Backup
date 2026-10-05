import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, FolderKanban, Handshake, LayoutDashboard, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/queryClient";
import { useAiStatus } from "@/hooks/use-ai-status";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  { icon: FolderKanban, label: "Which projects are at risk right now?" },
  { icon: Handshake, label: "Summarise my CRM pipeline this quarter" },
  { icon: LayoutDashboard, label: "What needs my attention across the business today?" },
];

/**
 * "Ask Jiganto" — the AI landing page.
 *
 * This is the dedicated, Google-style conversational entry point described
 * in the Jiganto design principles ("AI underpinning everything, in one
 * central database... its own landing page like Google functionality").
 * Before this page existed, the only way to reach the AI was a floating
 * chat button that was itself hidden on most of the app's routes
 * (see AIAssistant.tsx's `hideFab` logic) — so despite the chat engine
 * working, AI was effectively unreachable and ungrounded in practice.
 *
 * This page reuses the same /api/conversations chat engine (persistence,
 * streaming, per-org token metering all already exist there) but passes
 * `grounded: true` on each message so the backend prepends a live-data
 * system prompt built from the tenant's real Projects/CRM/Dashboard data
 * (see server/ai/landing-grounding.ts) — answers reference real projects
 * and figures instead of generic text.
 */
export default function AiLandingPage() {
  const { data: aiStatus, isLoading: aiStatusLoading } = useAiStatus(true);
  const aiEnabled = aiStatus?.modules.assistant ?? false;

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasConversation = messages.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const ensureConversation = async (): Promise<number | null> => {
    if (conversationId) return conversationId;
    try {
      const res = await fetchWithAuth("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Ask Jiganto" }),
      });
      const data = await res.json();
      setConversationId(data.id);
      return data.id as number;
    } catch (err) {
      console.error("Failed to start Ask Jiganto conversation", err);
      return null;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !aiEnabled || isLoading) return;
    const convId = await ensureConversation();
    if (!convId) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetchWithAuth(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, grounded: true }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to get a response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantMsg += data.content;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1].content = assistantMsg;
                return next;
              });
            }
          } catch {
            // ignore malformed SSE chunk
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry — I ran into a problem answering that. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(inputValue);
  };

  return (
    <div className="flex min-h-full w-full flex-col items-center bg-background px-4">
      <div className={cn("flex w-full max-w-3xl flex-col", hasConversation ? "pt-8" : "flex-1 justify-center")}>
        {!hasConversation && (
          <div className="mb-8 flex flex-col items-center text-center" data-testid="ai-landing-hero">
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, hsl(var(--primary)/0.7) 100%)" }}
            >
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Ask Jiganto</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Your AI across the whole platform — one question, grounded in your live Projects, CRM and
              dashboard data.
            </p>
          </div>
        )}

        {hasConversation && (
          <div className="mb-4 flex flex-col gap-4 overflow-y-auto" data-testid="ai-landing-thread">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.content || (isLoading && i === messages.length - 1 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              aiStatusLoading
                ? "Checking availability…"
                : aiEnabled
                  ? "Ask anything about your projects, clients or business…"
                  : "AI isn't configured yet — set OPENAI_API_KEY to enable Ask Jiganto"
            }
            disabled={!aiEnabled || aiStatusLoading}
            rows={1}
            className="min-h-[52px] resize-none rounded-2xl border-border bg-card py-3.5 pl-5 pr-14 text-[15px] shadow-sm focus-visible:ring-1"
            data-testid="ai-landing-input"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!aiEnabled || !inputValue.trim() || isLoading}
            className="absolute bottom-2.5 right-2.5 h-8 w-8 rounded-full"
            data-testid="ai-landing-send"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {!hasConversation && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => sendMessage(p.label)}
                disabled={!aiEnabled}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                data-testid={`ai-landing-suggestion-${p.label.slice(0, 10)}`}
              >
                <p.icon className="h-3.5 w-3.5" />
                {p.label}
                <ArrowUpRight className="h-3 w-3 opacity-50" />
              </button>
            ))}
          </div>
        )}

        {!aiStatusLoading && !aiEnabled && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Ask Jiganto needs an OpenAI API key configured for this workspace before it can respond.
          </p>
        )}
      </div>
    </div>
  );
}
