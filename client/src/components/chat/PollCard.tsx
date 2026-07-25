import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { BarChart2, Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { chatFont } from "@/lib/chat-utils";
import { apiRequest } from "@/lib/queryClient";
import { ChatButtonSpinner } from "@/components/chat/ChatLoading";
import { useChatConfig } from "@/hooks/use-chat-realtime";
import { useChatPollRealtime } from "@/hooks/use-poll-realtime";

export type PollData = {
  id: number;
  question: string;
  options: string[];
  durationMinutes: number;
  anonymous: boolean;
  closedAt: string | null;
  voteCounts: number[];
  totalVotes: number;
  myVote: number | null;
  isClosed: boolean;
};

export function PollCard({ pollId }: { pollId: number }) {
  const queryClient = useQueryClient();
  const { data: chatConfig } = useChatConfig();
  const realtime = Boolean(chatConfig?.supabaseRealtime);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [`/api/chat/polls/${pollId}`] });
  }, [queryClient, pollId]);

  useChatPollRealtime(pollId, realtime, invalidate);

  const { data: poll, isLoading } = useQuery<PollData>({
    queryKey: [`/api/chat/polls/${pollId}`],
    refetchInterval: realtime ? false : 5000,
  });

  const vote = useMutation({
    mutationFn: async (optionIndex: number) => {
      return apiRequest("POST", `/api/chat/polls/${pollId}/vote`, { optionIndex });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/chat/polls/${pollId}`] });
    },
  });

  if (isLoading || !poll) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 w-full max-w-md animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-3" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-muted rounded mb-2" />
        ))}
      </div>
    );
  }

  const hasVoted = poll.myVote !== null;
  const showBars = hasVoted || poll.isClosed;

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 w-full max-w-md mt-1" data-testid={`poll-card-${pollId}`}>
      <div className="flex items-start gap-2 mb-3">
        <BarChart2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug">{poll.question}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {poll.isClosed ? "Poll closed" : `${poll.totalVotes} vote${poll.totalVotes !== 1 ? "s" : ""}`}
            {poll.anonymous && <span>· Anonymous</span>}
          </p>
        </div>
        {poll.isClosed && <Badge variant="secondary" className={cn("shrink-0", chatFont.badge)}>Closed</Badge>}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((option, i) => {
          const count = poll.voteCounts[i] || 0;
          const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
          const isMyVote = poll.myVote === i;
          const canClick = !poll.isClosed && !vote.isPending;
          return (
            <button
              key={i}
              type="button"
              onClick={() => canClick && vote.mutate(i)}
              disabled={!canClick}
              className={cn(
                "w-full text-left rounded-lg border px-3 py-2 text-sm transition-all relative overflow-hidden",
                canClick ? "hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer" : "cursor-default",
                isMyVote ? "border-indigo-500 bg-indigo-100 dark:bg-indigo-950/40 font-medium" : "border-border bg-background",
              )}
              data-testid={`poll-option-${pollId}-${i}`}
            >
              {showBars && (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-lg transition-all duration-700",
                    isMyVote ? "bg-indigo-100 dark:bg-indigo-950/40" : "bg-muted/60",
                  )}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {vote.isPending && isMyVote ? <ChatButtonSpinner className="h-3 w-3" /> : null}
                  {isMyVote && !vote.isPending && <Check className="h-3 w-3 text-indigo-500 shrink-0" />}
                  <span>{option}</span>
                </span>
                {showBars && <span className="text-xs text-muted-foreground shrink-0 font-medium">{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
