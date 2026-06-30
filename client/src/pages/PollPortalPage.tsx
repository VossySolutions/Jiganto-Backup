import { useState, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { useSurveyColors } from "@/lib/survey-constants";
import { SurveyLoadingState, SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import { useChatConfig } from "@/hooks/use-chat-realtime";
import { useModulePollRealtime } from "@/hooks/use-poll-realtime";
import "@/styles/surveys.css";

type PollData = {
  id: number;
  question: string;
  options: string[];
  pollType: string;
  anonymous: boolean;
  showResultsToVoters: boolean;
  voteCounts: number[];
  totalVotes: number;
  myVote?: number[];
  isClosed?: boolean;
  status: string;
};

const VOTER_SESSION_KEY = "jiganto_poll_voter_session";

function getOrCreateVoterSession(): string {
  let session = localStorage.getItem(VOTER_SESSION_KEY);
  if (!session) {
    session = crypto.randomUUID();
    localStorage.setItem(VOTER_SESSION_KEY, session);
  }
  return session;
}

export default function PollPortalPage() {
  const C = useSurveyColors();
  const { token } = useParams<{ token: string }>();
  const [selected, setSelected] = useState<number[]>([]);
  const voterSession = useMemo(() => getOrCreateVoterSession(), []);
  const { data: chatConfig } = useChatConfig();
  const realtime = Boolean(chatConfig?.supabaseRealtime);

  const { data: poll, isLoading, refetch } = useQuery<PollData>({
    queryKey: ["/api/polls/by-token", token, voterSession],
    queryFn: async () => {
      const url = `/api/polls/by-token/${token}?voterSession=${encodeURIComponent(voterSession)}`;
      const res = await fetchWithAuth(url, { credentials: "include" });
      if (!res.ok) throw new Error("Poll not found");
      return res.json();
    },
    refetchInterval: realtime ? false : 3000,
  });

  const onPollChange = useCallback(() => { void refetch(); }, [refetch]);
  useModulePollRealtime(poll?.id ?? null, realtime && !!poll?.id, onPollChange);

  const voteMut = useMutation({
    mutationFn: async (optionIndexes: number[]) => {
      const res = await fetchWithAuth(`/api/polls/by-token/${token}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ optionIndexes, voterSession }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Vote failed");
      }
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  if (isLoading || !poll) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <SurveyLoadingState label="Loading poll…" />
      </div>
    );
  }

  const total = poll.totalVotes || 1;
  const showBars = poll.myVote?.length || poll.isClosed || poll.showResultsToVoters;

  const toggle = (i: number) => {
    if (poll.pollType === "multi") {
      setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
    } else {
      setSelected([i]);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: C.surface, borderRadius: 20, maxWidth: 520, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.2)", overflow: "hidden" }}>
        <div style={{ padding: "28px 32px", borderBottom: `1px solid ${C.line}` }}>
          {poll.isClosed && <div style={{ background: C.tealL, color: C.teal, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12, display: "inline-block" }}>Final result</div>}
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{poll.question}</h1>
          <p style={{ fontSize: 12, color: C.ink4, marginTop: 8 }}>{poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}{poll.anonymous ? " · Anonymous" : ""}</p>
        </div>
        <div style={{ padding: "24px 32px" }}>
          {poll.options.map((opt, i) => {
            const count = poll.voteCounts?.[i] || 0;
            const pct = Math.round((count / total) * 100);
            const isSel = selected.includes(i) || poll.myVote?.includes(i);
            return (
              <button key={i} type="button" disabled={poll.isClosed || voteMut.isPending}
                onClick={() => { toggle(i); if (poll.pollType === "single") voteMut.mutate([i]); }}
                style={{ width: "100%", textAlign: "left", padding: "12px 16px", marginBottom: 10, border: `1.5px solid ${isSel ? C.teal : C.line}`, borderRadius: 10, background: isSel ? C.tealL : C.surface, cursor: poll.isClosed ? "default" : "pointer", position: "relative", overflow: "hidden" }}>
                {showBars && (
                  <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: C.tealL, opacity: 0.5 }} />
                )}
                <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: isSel ? 600 : 400 }}>{opt}</span>
                  {showBars && <span style={{ fontSize: 12, color: C.ink4 }}>{pct}%</span>}
                </div>
              </button>
            );
          })}
          {poll.pollType === "multi" && !poll.isClosed && selected.length > 0 && (
            <button onClick={() => voteMut.mutate(selected)} disabled={voteMut.isPending}
              style={{ width: "100%", padding: "12px", background: C.teal, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", marginTop: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {voteMut.isPending && <SurveyButtonSpinner />}
              Submit vote
            </button>
          )}
          {voteMut.isError && (
            <p style={{ color: C.rose, fontSize: 13, marginTop: 12 }}>{(voteMut.error as Error).message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
