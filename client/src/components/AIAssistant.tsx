import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bot, Send, Sparkles, User, Loader2, X,
  FileText, BarChart3, CheckSquare, Users, Lightbulb,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/queryClient";
import { useAiStatus } from "@/hooks/use-ai-status";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const quickActions = [
  { icon: FileText, label: "Summarize document", prompt: "Summarize the current document" },
  { icon: BarChart3, label: "Analyze data", prompt: "Help me analyze this data" },
  { icon: CheckSquare, label: "Create tasks", prompt: "Help me create tasks from this" },
  { icon: Lightbulb, label: "Suggest improvements", prompt: "Suggest improvements" },
];

export function AIAssistantButton() {
  const { data: aiStatus, isLoading: aiStatusLoading } = useAiStatus();
  const aiEnabled = aiStatus?.modules.assistant ?? false;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && !conversationId && aiEnabled) {
      fetchWithAuth("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Jiganto AI Session" }),
      })
        .then(res => res.json())
        .then(data => setConversationId(data.id))
        .catch(err => console.error("Failed to init chat", err));
    }
  }, [isOpen, conversationId, aiEnabled]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    if (!aiEnabled) return;
    if (!conversationId) return;

    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetchWithAuth(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg }),
      });

      if (!response.ok) throw new Error("Failed to send message");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantMsg += data.content;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantMsg;
                  return newMsgs;
                });
              }
            } catch (parseErr) {
              console.error("Error parsing SSE", parseErr);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "I'm sorry, I encountered an error processing your request." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    if (!aiEnabled) return;
    setInputValue(prompt);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[51] h-12 w-12 rounded-full shadow-lg text-white border border-white/20"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 50%, #0DE7F9 100%)",
            }}
            data-testid="ai-assistant-fab"
          >
            <Sparkles className="h-5 w-5 drop-shadow-sm" />
            <span
              className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background"
              style={{ backgroundColor: aiEnabled ? "#22C55E" : "#6B7280" }}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="flex items-center gap-2">
          <Sparkles className="h-3 w-3" />
          <span>AI Assistant</span>
        </TooltipContent>
      </Tooltip>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-[420px] sm:w-[480px] flex flex-col h-full p-0 border-l gap-0">
          <SheetHeader className="px-5 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-3 text-lg font-semibold">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #6366F1 0%, #0DE7F9 100%)" }}
                >
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span>Jiganto AI</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {aiStatusLoading
                      ? "Checking availability…"
                      : aiEnabled
                        ? "Ready to assist"
                        : "Not configured"}
                  </span>
                </div>
              </SheetTitle>
              <div className="flex items-center gap-2">
                {!aiStatusLoading && !aiEnabled && (
                  <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-600">
                    OPENAI_API_KEY required
                  </Badge>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  data-testid="ai-assistant-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-4">
              {aiStatusLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#6366F1" }} />
                  <p className="text-sm">Checking AI availability…</p>
                </div>
              ) : !aiEnabled ? (
                <div className="space-y-6 py-4">
                  <div className="text-center px-4">
                    <div
                      className="h-20 w-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                      style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(13,231,249,0.1) 100%)" }}
                    >
                      <Sparkles className="h-10 w-10" style={{ color: "#6366F1" }} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Jiganto AI Assistant</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Add <code className="text-xs bg-muted px-1 py-0.5 rounded">OPENAI_API_KEY</code> to the server <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> file, then restart the app. AI powers Chat, Dashboard builder, Business insights, and Survey generation.
                    </p>
                  </div>

                  <div className="space-y-2 px-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-3">
                      What AI Can Do For You
                    </p>
                    {[
                      { icon: FileText, title: "Document Intelligence", desc: "Summarize, draft, and improve documents with AI-powered writing" },
                      { icon: BarChart3, title: "Data Analysis", desc: "Get instant insights from your project data and metrics" },
                      { icon: CheckSquare, title: "Task Automation", desc: "Auto-generate tasks, checklists, and action items" },
                      { icon: Users, title: "Resource Optimization", desc: "Smart resource allocation and workload balancing" },
                      { icon: Zap, title: "Process Improvement", desc: "Identify bottlenecks and suggest workflow improvements" },
                    ].map((feature) => (
                      <div
                        key={feature.title}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div
                          className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(13,231,249,0.08) 100%)" }}
                        >
                          <feature.icon className="h-4 w-4" style={{ color: "#6366F1" }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{feature.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="text-center py-8 px-4">
                      <div
                        className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(13,231,249,0.1) 100%)" }}
                      >
                        <Sparkles className="h-8 w-8" style={{ color: "#6366F1" }} />
                      </div>
                      <h3 className="text-lg font-medium mb-2">How can I help you?</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        I can analyze data, write content, manage tasks, and help across all modules.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {quickActions.map((action) => (
                          <button
                            key={action.label}
                            onClick={() => handleQuickAction(action.prompt)}
                            className="flex items-center gap-2 p-3 rounded-lg border text-left text-xs hover-elevate transition-colors"
                            data-testid={`ai-quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <action.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(13,231,249,0.1) 100%)" }}
                          >
                            <Bot className="h-4 w-4" style={{ color: "#6366F1" }} />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                            msg.role === "user"
                              ? "text-white rounded-tr-sm"
                              : "bg-muted text-foreground rounded-tl-sm"
                          )}
                          style={msg.role === "user" ? { background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)" } : undefined}
                        >
                          {msg.content}
                        </div>
                        {msg.role === "user" && (
                          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </motion.div>
                    ))}

                    {isLoading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(13,231,249,0.1) 100%)" }}
                        >
                          <Bot className="h-4 w-4" style={{ color: "#6366F1" }} />
                        </div>
                        <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={scrollRef} />
                </>
              )}
            </div>
          </ScrollArea>

          {aiEnabled && (
            <div className="px-5 py-4 mt-auto border-t flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask Jiganto AI anything..."
                  className="flex-1 rounded-lg"
                  data-testid="ai-chat-input"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !inputValue.trim()}
                  className="rounded-lg shrink-0 text-white border-0"
                  style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)" }}
                  data-testid="ai-send-button"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
