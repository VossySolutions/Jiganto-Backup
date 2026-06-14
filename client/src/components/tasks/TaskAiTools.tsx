import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ListOrdered, CalendarDays, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildTasksQueryKey, type TaskFilters } from "./constants";
import type { AggregatedTask } from "@shared/models/tasks";

interface TaskAiToolsProps {
  filters: TaskFilters;
  tasks: AggregatedTask[];
  onPrioritized?: (orderedIds: string[]) => void;
}

export function TaskAiTools({ filters, tasks, onPrioritized }: TaskAiToolsProps) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [weekSummary, setWeekSummary] = useState("");

  const prioritizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tasks/ai/prioritize", {});
      return res.json() as Promise<{ orderedIds: string[]; rationale: string }>;
    },
    onSuccess: (data) => {
      onPrioritized?.(data.orderedIds);
      toast({ title: "Tasks prioritised", description: data.rationale });
    },
  });

  const weekMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tasks/ai/summarise-week", {});
      return res.json() as Promise<{ summary: string }>;
    },
    onSuccess: (data) => setWeekSummary(data.summary),
  });

  const fromTextMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tasks/ai/from-text", { text });
      return res.json();
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: buildTasksQueryKey(filters) });
      setText("");
      toast({ title: "Tasks created", description: `${data.parsed?.length ?? 0} action item(s) extracted.` });
    },
  });

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> AI assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => prioritizeMutation.mutate()} disabled={!tasks.length || prioritizeMutation.isPending}>
            {prioritizeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ListOrdered className="h-4 w-4 mr-1" />}
            Prioritise my tasks
          </Button>
          <Button size="sm" variant="outline" onClick={() => weekMutation.mutate()} disabled={weekMutation.isPending}>
            {weekMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CalendarDays className="h-4 w-4 mr-1" />}
            Summarise my week
          </Button>
        </div>
        {weekSummary && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{weekSummary}</p>}
        <div>
          <Textarea
            rows={3}
            placeholder="Paste meeting notes or email text to extract action items..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            size="sm"
            className="mt-2 w-full sm:w-auto"
            disabled={!text.trim() || fromTextMutation.isPending}
            onClick={() => fromTextMutation.mutate()}
          >
            {fromTextMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Create tasks from text
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
