import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Send, Users, Pin, Link2, Sparkles, CheckCircle2, Zap, ExternalLink, AlertTriangle, Copy, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ChannelBridgeConfig, ChatNotificationPref } from "@shared/models/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { displayPersonName, formatMessageTime, getUserInitials, chatFont } from "@/lib/chat-utils";
import { renderChatMessageContent } from "@/lib/chat-message-content";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSearchHit } from "@shared/models/chat";
import { ChatButtonSpinner, ChatSpinner } from "@/components/chat/ChatLoading";

export type RightPanelMode =
  | { type: "thread"; messageId: number; channelId: number }
  | { type: "members"; channelId: number; notificationPref?: string }
  | { type: "search"; channelId: number }
  | { type: "pins"; channelId: number }
  | { type: "bridge"; channelId: number }
  | null;

export function ChatRightPanel({
  panel,
  currentUserId,
  isMobile,
  onClose,
  onJumpToMessage,
}: {
  panel: RightPanelMode;
  currentUserId: string;
  isMobile?: boolean;
  onClose: () => void;
  onJumpToMessage?: (messageId: number) => void;
}) {
  if (!panel) return null;

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <div
        className={cn(
          "bg-card flex flex-col shrink-0 animate-in slide-in-from-right duration-200 min-h-0 overflow-hidden",
          isMobile
            ? "fixed inset-y-0 right-0 z-50 w-full max-w-md border-l shadow-xl"
            : "w-80 lg:w-96 border-l relative h-full",
        )}
      >
      <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <h3 className={chatFont.panelTitle}>
          {panel.type === "thread" && "Thread"}
          {panel.type === "members" && "Members & notifications"}
          {panel.type === "search" && "Search"}
          {panel.type === "pins" && "Pinned messages"}
          {panel.type === "bridge" && "Bridge connection"}
        </h3>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {panel.type === "thread" && (
        <ThreadPanel
          messageId={panel.messageId}
          channelId={panel.channelId}
          currentUserId={currentUserId}
        />
      )}
      {panel.type === "members" && (
        <MembersPanel channelId={panel.channelId} initialPref={panel.notificationPref} />
      )}
      {panel.type === "search" && (
        <SearchPanel channelId={panel.channelId} onJump={onJumpToMessage} />
      )}
      {panel.type === "pins" && <PinsPanel channelId={panel.channelId} />}
      {panel.type === "bridge" && <BridgePanel channelId={panel.channelId} />}
      </div>
    </>
  );
}

function ThreadPanel({
  messageId,
  channelId,
}: {
  messageId: number;
  channelId: number;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [threadSummary, setThreadSummary] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [`/api/chat/messages/${messageId}/thread`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/chat/messages/${messageId}/thread`);
      if (!res.ok) throw new Error("Failed to load thread");
      return res.json() as Promise<{
        parent: ChatMessage & { user?: { firstName?: string; lastName?: string } };
        replies: Array<
          ChatMessage & {
            user: { firstName: string | null; lastName: string | null; profileImageUrl: string | null };
          }
        >;
      }>;
    },
  });

  const sendReply = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/chat/channels/${channelId}/messages`, {
        content: reply.trim(),
        parentId: messageId,
      }),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: [`/api/chat/messages/${messageId}/thread`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${channelId}/messages`] });
    },
  });

  const summarize = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/chat/messages/${messageId}/summarize-thread`, {}),
    onSuccess: async (res) => {
      const body = (await res.json()) as { summary: string };
      setThreadSummary(body.summary);
    },
  });

  return (
    <>
      <div className="px-4 py-2 border-b space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
          onClick={() => summarize.mutate()}
          disabled={summarize.isPending}
        >
          {summarize.isPending ? <ChatButtonSpinner /> : <Sparkles className="h-3.5 w-3.5" />}
          {summarize.isPending ? "Summarising…" : "Summarise thread"}
        </Button>
        {threadSummary && (
          <div className="rounded-lg border bg-violet-500/10 border-violet-500/20 px-3 py-2 text-xs text-foreground/90 leading-relaxed">
            <p className={cn("font-semibold text-violet-600 mb-1 flex items-center gap-1", chatFont.badge)}>
              <Sparkles className="h-3 w-3" /> AI Summary
            </p>
            {threadSummary}
            <button
              type="button"
              className={cn("mt-1 hover:text-foreground block", chatFont.messageMeta)}
              onClick={() => setThreadSummary(null)}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <ChatSpinner label="Loading thread…" />
        ) : (
        <>
        {data?.parent && (
          <div className="mb-4 pb-4 border-b">
            <p className="text-xs font-semibold mb-1">{displayPersonName(data.parent.user as never)}</p>
            <p className="text-sm">{renderChatMessageContent(data.parent.content)}</p>
          </div>
        )}
        <div className="space-y-3">
          {data?.replies.map((r) => (
            <div key={r.id} className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={r.user.profileImageUrl || undefined} />
                <AvatarFallback className="text-[9px]">
                  {getUserInitials(r.user.firstName, r.user.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{displayPersonName(r.user)}</span>
                  <span className={chatFont.messageMeta}>{formatMessageTime(r.createdAt)}</span>
                </div>
                <p className="text-sm mt-0.5">{renderChatMessageContent(r.content)}</p>
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </ScrollArea>
      <div className="p-3 border-t flex gap-2">
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply in thread…"
          className="min-h-[40px] text-sm resize-none"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (reply.trim()) sendReply.mutate();
            }
          }}
        />
        <Button
          size="icon"
          className="shrink-0"
          disabled={!reply.trim() || sendReply.isPending}
          onClick={() => sendReply.mutate()}
        >
          {sendReply.isPending ? <ChatButtonSpinner /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </>
  );
}

function MembersPanel({
  channelId,
  initialPref,
}: {
  channelId: number;
  initialPref?: string;
}) {
  const queryClient = useQueryClient();
  const [pref, setPref] = useState<ChatNotificationPref>(
    (initialPref as ChatNotificationPref) || "mentions",
  );

  useEffect(() => {
    if (initialPref) setPref(initialPref as ChatNotificationPref);
  }, [initialPref, channelId]);

  const savePref = useMutation({
    mutationFn: async (p: ChatNotificationPref) =>
      apiRequest("PATCH", `/api/chat/channels/${channelId}/notifications`, { pref: p }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/chat/inbox"] });
    },
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: [`/api/chat/channels/${channelId}/members`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/chat/channels/${channelId}/members`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<
        Array<{
          user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null };
          role: string;
        }>
      >;
    },
  });

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
        <Label className="text-xs font-medium">Notification preference</Label>
        <Select
          value={pref}
          disabled={savePref.isPending}
          onValueChange={(v) => {
            const p = v as ChatNotificationPref;
            setPref(p);
            savePref.mutate(p);
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All messages</SelectItem>
            <SelectItem value="mentions">Mentions only</SelectItem>
            <SelectItem value="nothing">Nothing</SelectItem>
            <SelectItem value="muted">Muted</SelectItem>
          </SelectContent>
        </Select>
        {savePref.isPending && (
          <p className={chatFont.messageMeta}>Saving…</p>
        )}
      </div>
      {isLoading ? (
        <ChatSpinner label="Loading members…" className="py-4" />
      ) : (
      <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 px-4">
        <Users className="h-3.5 w-3.5" /> {members.length} members
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.user.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
            <Avatar className="h-8 w-8">
              <AvatarImage src={m.user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">
                {getUserInitials(m.user.firstName, m.user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{displayPersonName(m.user)}</p>
              <p className={cn("capitalize", chatFont.messageMeta)}>{m.role}</p>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </ScrollArea>
  );
}

function SearchPanel({
  channelId,
  onJump,
}: {
  channelId: number;
  onJump?: (messageId: number) => void;
}) {
  const [q, setQ] = useState("");
  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["/api/chat/search", channelId, q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const res = await fetchWithAuth(
        `/api/chat/search?q=${encodeURIComponent(q)}&channelId=${channelId}`,
      );
      if (!res.ok) throw new Error("Search failed");
      return res.json() as Promise<ChatSearchHit[]>;
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-3 border-b">
        <Input
          placeholder="Search in channel…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <ScrollArea className="flex-1 p-3">
        {q.trim().length < 2 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Type at least 2 characters</p>
        ) : isFetching ? (
          <p className="text-xs text-muted-foreground text-center py-8">Searching…</p>
        ) : hits.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No results</p>
        ) : (
          hits.map((h) => (
            <button
              key={h.messageId}
              type="button"
              className="w-full text-left p-2 rounded-lg hover:bg-muted/60 mb-2"
              onClick={() => onJump?.(h.messageId)}
            >
              <div className={cn("flex items-center justify-between mb-1", chatFont.messageMeta)}>
                <span>{displayPersonName(h.user)}</span>
                <span>{formatMessageTime(h.createdAt)}</span>
              </div>
              <p className="text-sm line-clamp-2">{renderChatMessageContent(h.content)}</p>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

function PinsPanel({ channelId }: { channelId: number }) {
  const { data: pins = [], isLoading } = useQuery({
    queryKey: [`/api/chat/channels/${channelId}/pins`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/chat/channels/${channelId}/pins`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<
        Array<{
          message: {
            id: number;
            content: string;
            createdAt: string;
            user: { firstName: string | null; lastName: string | null };
          };
        }>
      >;
    },
  });

  return (
    <ScrollArea className="flex-1 p-4">
      {isLoading ? (
        <ChatSpinner label="Loading pins…" />
      ) : pins.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No pinned messages</p>
      ) : (
        pins.map((p) => (
          <div key={p.message.id} className="mb-3 p-3 rounded-lg border">
            <div className={cn("flex items-center gap-1 mb-1", chatFont.messageMeta)}>
              <Pin className="h-3 w-3" />
              {displayPersonName(p.message.user)} · {formatMessageTime(p.message.createdAt)}
            </div>
            <p className="text-sm line-clamp-4">{renderChatMessageContent(p.message.content)}</p>
          </div>
        ))
      )}
    </ScrollArea>
  );
}

function BridgePanel({ channelId }: { channelId: number }) {
  const queryClient = useQueryClient();
  const { data: channel, isLoading } = useQuery({
    queryKey: [`/api/chat/channels/${channelId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/chat/channels/${channelId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as { bridgeConfig?: ChannelBridgeConfig | null };
    },
  });

  const [provider, setProvider] = useState<"slack" | "teams">("teams");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackChannelId, setSlackChannelId] = useState("");
  const [active, setActive] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const b = channel?.bridgeConfig;
    if (b) {
      setProvider(b.provider);
      setWebhookUrl(b.webhookUrl ?? "");
      setSlackChannelId(b.slackChannelId ?? b.externalChannelName ?? "");
      setActive(b.active);
    }
  }, [channel?.bridgeConfig]);

  const save = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/chat/channels/${channelId}/bridge`, {
        provider,
        webhookUrl: webhookUrl || undefined,
        slackChannelId: slackChannelId || undefined,
        externalChannelName: slackChannelId || undefined,
        active,
      } as ChannelBridgeConfig),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${channelId}`] });
      void queryClient.invalidateQueries({ queryKey: ["/api/chat/inbox"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const copyEnvVar = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const bridgeConfig = channel?.bridgeConfig;
  const isConfigured = bridgeConfig && (bridgeConfig.webhookUrl || bridgeConfig.slackChannelId);

  const providerMeta = {
    teams: {
      label: "Microsoft Teams",
      color: "#6264A7",
      bg: "bg-[#6264A7]/10",
      border: "border-[#6264A7]/40",
      envVar: "TEAMS_INCOMING_WEBHOOK_URL",
      docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#6264A7]">
          <path d="M20.625 6.75h-4.875V3.375A1.125 1.125 0 0014.625 2.25h-5.25A1.125 1.125 0 008.25 3.375V6.75H3.375A1.125 1.125 0 002.25 7.875v9a1.125 1.125 0 001.125 1.125H8.25v2.625A1.125 1.125 0 009.375 21.75h5.25A1.125 1.125 0 0015.75 20.625V18H20.625a1.125 1.125 0 001.125-1.125v-9a1.125 1.125 0 00-1.125-1.125zM12 16.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z" />
        </svg>
      ),
    },
    slack: {
      label: "Slack",
      color: "#4A154B",
      bg: "bg-[#4A154B]/10",
      border: "border-[#4A154B]/30",
      envVar: "SLACK_BOT_TOKEN",
      docsUrl: "https://api.slack.com/authentication/token-types",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M6 15a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2h2v2zm1 0a2 2 0 012-2 2 2 0 012 2v5a2 2 0 01-2 2 2 2 0 01-2-2v-5z" fill="#E01E5A"/>
          <path d="M9 6a2 2 0 01-2-2 2 2 0 01-2-2 2 2 0 012 2h2V6zm0 1a2 2 0 012 2 2 2 0 01-2 2H4a2 2 0 01-2-2 2 2 0 012-2h5z" fill="#36C5F0"/>
          <path d="M18 9a2 2 0 012 2 2 2 0 012 2 2 2 0 01-2-2h-2V9zm-1 0a2 2 0 01-2-2 2 2 0 012-2h5a2 2 0 012 2 2 2 0 01-2 2h-5z" fill="#2EB67D"/>
          <path d="M15 18a2 2 0 012 2 2 2 0 012 2 2 2 0 01-2-2h-2v-2zm-1 0a2 2 0 01-2-2 2 2 0 012-2v5a2 2 0 01-2 2 2 2 0 01-2-2v-5z" fill="#ECB22E"/>
        </svg>
      ),
    },
  };

  const meta = providerMeta[provider];

  return (
    <ScrollArea className="flex-1">
      {isLoading ? (
        <div className="p-6">
          <ChatSpinner label="Loading bridge settings…" />
        </div>
      ) : (
        <div className="p-4 space-y-5">

          {/* Status banner */}
          <div className={`rounded-xl p-3 flex items-center gap-3 border ${
            active && isConfigured
              ? "bg-emerald-500/8 border-emerald-500/25"
              : "bg-muted/40 border-border"
          }`}>
            <div className={`p-1.5 rounded-lg ${active && isConfigured ? "bg-emerald-500/15" : "bg-muted"}`}>
              <Link2 className={`h-4 w-4 ${active && isConfigured ? "text-emerald-600" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {active && isConfigured ? "Bridge active" : "Bridge inactive"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {active && isConfigured
                  ? `Forwarding to ${meta.label}`
                  : "Configure and enable to start forwarding"}
              </p>
            </div>
            <div className={`h-2 w-2 rounded-full shrink-0 ${active && isConfigured ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
          </div>

          {/* Provider selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provider</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["teams", "slack"] as const).map((p) => {
                const pm = providerMeta[p];
                const selected = provider === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      selected
                        ? `${pm.border} ${pm.bg}`
                        : "border-border hover:border-border/80 hover:bg-muted/40"
                    }`}
                  >
                    {pm.icon}
                    <span className="text-xs font-medium">{pm.label}</span>
                    {selected && (
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pm.color }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Webhook / channel config */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {provider === "teams" ? "Incoming webhook URL" : "Slack channel ID"}
            </Label>
            <Input
              value={provider === "teams" ? webhookUrl : slackChannelId}
              onChange={(e) =>
                provider === "teams"
                  ? setWebhookUrl(e.target.value)
                  : setSlackChannelId(e.target.value)
              }
              placeholder={provider === "teams" ? "https://outlook.office.com/webhook/…" : "C0123ABCDEF"}
              className="font-mono text-xs"
            />
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noreferrer"
              className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors", chatFont.emptyHint)}
            >
              <ExternalLink className="h-3 w-3" />
              How to get your {provider === "teams" ? "webhook URL" : "channel ID"}
            </a>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${active ? "bg-emerald-500/15" : "bg-muted"}`}>
                <Zap className={`h-3.5 w-3.5 ${active ? "text-emerald-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm font-medium">Enable bridge</p>
                <p className={chatFont.emptyHint}>Forward new messages in real time</p>
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          {/* Error display */}
          {bridgeConfig?.lastError && (
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/8 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-destructive">Last delivery error</p>
                <p className="text-xs text-muted-foreground mt-0.5 break-all">{bridgeConfig.lastError}</p>
              </div>
            </div>
          )}

          {/* Save button */}
          <Button
            className="w-full gap-2"
            onClick={() => save.mutate()}
            disabled={save.isPending || saved}
          >
            {save.isPending ? (
              <ChatButtonSpinner />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {save.isPending ? "Saving…" : saved ? "Saved!" : "Save bridge"}
          </Button>

          {/* Env var hints */}
          <div className="space-y-2">
            <p className={cn("font-semibold uppercase tracking-wide", chatFont.sectionHeader)}>
              Required environment variable
            </p>
            <div className="rounded-lg bg-muted/60 border p-2.5 flex items-center justify-between gap-2">
              <code className={cn("font-mono text-foreground", chatFont.emptyHint)}>{meta.envVar}</code>
              <button
                type="button"
                onClick={() => copyEnvVar(meta.envVar)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === meta.envVar ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className={chatFont.emptyHint}>
              Set this in your <code className="bg-muted px-1 rounded">.env</code> file on the server, then restart to apply.
            </p>
          </div>

        </div>
      )}
    </ScrollArea>
  );
}
