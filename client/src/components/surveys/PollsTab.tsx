import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  pollLink,
  fmtDate,
  qrCodeUrl,
  useSurveyColors
} from "@/lib/survey-constants";
import { exportPollPng } from "@/lib/survey-exports";
import { fetchModulePolls, fetchModulePoll } from "@/lib/survey-api";
import type { ModulePoll } from "@shared/models/surveys";
import { SurveyLoadingState, SurveyRowSkeleton, SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import { useChatConfig } from "@/hooks/use-chat-realtime";
import { useModulePollRealtime } from "@/hooks/use-poll-realtime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Link2, XCircle } from "lucide-react";

const DURATIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "1 day", minutes: 1440 },
];

function PollResultBars({ poll }: { poll: { question: string; options: string[]; voteCounts: number[]; totalVotes: number; anonymous: boolean; votersByOption?: Record<number, { id: string | null; name: string | null }[]>; isClosed?: boolean } }) {
  const C = useSurveyColors();
  const total = poll.totalVotes || 1;
  const maxIdx = poll.voteCounts.indexOf(Math.max(...poll.voteCounts));
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
      {poll.isClosed && <div style={{ background: C.tealL, color: C.teal, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Final result · Poll closed</div>}
      <div style={{ fontWeight: 600, marginBottom: 16 }}>{poll.question}</div>
      {poll.options.map((opt, i) => {
        const count = poll.voteCounts[i] || 0;
        const pct = Math.round((count / total) * 100);
        const isWinner = poll.isClosed && i === maxIdx && count > 0;
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: isWinner ? 700 : 500 }}>{opt} {isWinner && "🏆"}</span>
              <span style={{ color: C.ink4 }}>{count} ({pct}%)</span>
            </div>
            <div style={{ height: 24, background: C.paper2, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(pct, 2)}%`, height: "100%", background: isWinner ? C.teal : C.tealM, transition: "width .5s" }} />
            </div>
            {!poll.anonymous && poll.votersByOption?.[i]?.length ? (
              <div style={{ fontSize: 11, color: C.ink4, marginTop: 4 }}>{poll.votersByOption[i].map(v => v.name || "User").join(", ")}</div>
            ) : null}
          </div>
        );
      })}
      <div className="flex gap-2 flex-wrap mt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => exportPollPng(poll.question, poll.options, poll.voteCounts)}>
          ↓ PNG
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          const text = poll.options.map((o, i) => `${o}: ${poll.voteCounts[i]} (${Math.round((poll.voteCounts[i] / total) * 100)}%)`).join("\n");
          navigator.clipboard.writeText(`${poll.question}\n\n${text}`);
        }}>
          Copy summary
        </Button>
      </div>
    </div>
  );
}

export function PollsTab() {
  const C = useSurveyColors();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: chatConfig } = useChatConfig();
  const realtime = Boolean(chatConfig?.supabaseRealtime);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [pollType, setPollType] = useState<"single" | "multi">("single");
  const [duration, setDuration] = useState(60);
  const [anonymous, setAnonymous] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [allowChange, setAllowChange] = useState(false);
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);

  const { data: polls = [], isLoading, isError, refetch } = useQuery<ModulePoll[]>({
    queryKey: ["/api/surveys/polls"],
    queryFn: fetchModulePolls,
    staleTime: 30_000,
  });

  const { data: pollDetail, isLoading: detailLoading, isError: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ["/api/surveys/polls", selectedPollId],
    queryFn: () => fetchModulePoll(selectedPollId!),
    enabled: !!selectedPollId,
    refetchInterval: realtime ? false : 3000,
    staleTime: 30_000,
  });

  const onPollChange = useCallback(() => {
    if (selectedPollId) void refetchDetail();
  }, [selectedPollId, refetchDetail]);
  useModulePollRealtime(selectedPollId, realtime && !!selectedPollId, onPollChange);

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/surveys/polls", body),
    onSuccess: async (res) => {
      const poll = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/surveys/polls"] });
      toast({ title: "Poll created ✓" });
      setCreating(false);
      setSelectedPollId(poll.id);
      setQuestion(""); setOptions(["", "", ""]);
    },
  });

  const closeMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/surveys/polls/${id}/close`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/surveys/polls"] }); qc.invalidateQueries({ queryKey: ["/api/surveys/polls", selectedPollId] }); toast({ title: "Poll closed" }); },
  });

  const validOpts = options.map(o => o.trim()).filter(Boolean);

  if (creating) {
    return (
      <div className="w-full max-w-2xl">
        <h2 className="text-lg font-bold mb-4">Create Poll</h2>
        <input value={question} onChange={e => setQuestion(e.target.value.slice(0, 200))} placeholder="Question (max 200 chars)"
          className="survey-input mb-3" />
        {options.map((opt, i) => (
          <input key={i} value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
            placeholder={`Option ${i + 1}`}
            className="survey-input mb-2" />
        ))}
        {options.length < 6 && (
          <button onClick={() => setOptions([...options, ""])} style={{ background: "none", border: `1px dashed ${C.line2}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", marginBottom: 12 }}>+ Add option</button>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 12 }}>
          <select value={pollType} onChange={e => setPollType(e.target.value as "single" | "multi")} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${C.line2}` }}>
            <option value="single">Single choice</option><option value="multi">Multiple choice</option>
          </select>
          <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${C.line2}` }}>
            {DURATIONS.map(d => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, fontSize: 13 }}>
          <label><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> Anonymous</label>
          <label><input type="checkbox" checked={showResults} onChange={e => setShowResults(e.target.checked)} /> Show results to voters</label>
          <label><input type="checkbox" checked={allowChange} onChange={e => setAllowChange(e.target.checked)} /> Allow vote change</label>
        </div>
        <div className="flex gap-2 flex-wrap mt-4">
          <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
          <Button type="button" onClick={() => createMut.mutate({ question, options: validOpts, pollType, durationMinutes: duration, anonymous, showResultsToVoters: showResults, allowVoteChange: allowChange })}
            disabled={!question.trim() || validOpts.length < 2 || createMut.isPending}>
            {createMut.isPending && <SurveyButtonSpinner />}
            {createMut.isPending ? "Creating…" : "Create Poll"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="survey-polls-header">
        <div>
          <h2 className="text-lg font-bold">Polls</h2>
          <p className="text-sm text-muted-foreground mt-1">Quick consensus — live results, under 30 seconds to create</p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Poll
        </Button>
      </div>

      {isError && (
        <div style={{ background: C.roseL, borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: C.rose }}>Failed to load polls.</span>
          <button onClick={() => refetch()} style={{ padding: "6px 12px", border: `1px solid ${C.line}`, borderRadius: 6, background: C.surface, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      <div className={cn("survey-polls-layout", selectedPollId && pollDetail ? "survey-polls-layout--split" : "")}>
        <div>
          {isLoading ? <SurveyRowSkeleton rows={4} /> : polls.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.ink4, border: `2px dashed ${C.line2}`, borderRadius: 12 }}>No polls yet</div>
          ) : polls.map(p => (
            <div key={p.id} onClick={() => setSelectedPollId(p.id)}
              style={{ background: C.surface, border: `1.5px solid ${selectedPollId === p.id ? C.teal : C.line}`, borderRadius: 10, padding: 16, marginBottom: 10, cursor: "pointer" }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p.question}</div>
              <div style={{ fontSize: 12, color: C.ink4 }}>
                {p.status} · {fmtDate(p.createdAt?.toString())} · {p.createdByName || "Unknown"}
                {p.closeAt && ` · Closes ${fmtDate(p.closeAt.toString())}`}
              </div>
            </div>
          ))}
        </div>
        {selectedPollId && (
          <div>
            {detailLoading ? <SurveyLoadingState label="Loading poll results…" size="sm" /> : detailError ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <p style={{ color: C.rose, fontSize: 13, marginBottom: 10 }}>Failed to load poll.</p>
                <button onClick={() => refetchDetail()} style={{ padding: "6px 12px", border: `1px solid ${C.line}`, borderRadius: 6, background: C.surface, cursor: "pointer" }}>Retry</button>
              </div>
            ) : pollDetail ? (
              <>
                <PollResultBars poll={pollDetail} />
                <div className="flex gap-2 flex-wrap mt-2">
                  {pollDetail.token && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(pollLink(pollDetail.token!)); toast({ title: "Link copied" }); }}>
                        <Link2 className="h-3.5 w-3.5 mr-1.5" />
                        Copy link
                      </Button>
                      <img src={qrCodeUrl(pollLink(pollDetail.token))} alt="QR" width={80} height={80} className="rounded-md border border-border" />
                    </>
                  )}
                  {pollDetail.status === "active" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => closeMut.mutate(selectedPollId)} disabled={closeMut.isPending}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      {closeMut.isPending ? <SurveyButtonSpinner /> : <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                      Close poll
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: C.ink4, fontSize: 13 }}>Poll unavailable</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
