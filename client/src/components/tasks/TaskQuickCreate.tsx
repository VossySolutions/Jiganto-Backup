import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFilters } from "./constants";
import { buildTasksQueryKey } from "./constants";

interface TaskQuickCreateProps {
  filters: TaskFilters;
  onCreated?: () => void;
}

export function TaskQuickCreate({ filters, onCreated }: TaskQuickCreateProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [detecting, setDetecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; dueDate?: string; priority: string }) => {
      const res = await apiRequest("POST", "/api/tasks", {
        title: payload.title,
        dueDate: payload.dueDate || undefined,
        priority: payload.priority,
        source: "personal",
        isPersonal: true,
      });
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: buildTasksQueryKey(filters) });
      void queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
      setTitle("");
      setDueDate("");
      setPriority("medium");
      setOpen(false);
      onCreated?.();
    },
  });

  const handleSubmit = async () => {
    if (!title.trim() || createMutation.isPending || detecting) return;
    let detectedDue = dueDate;
    if (!detectedDue) {
      try {
        setDetecting(true);
        const detect = await apiRequest("POST", "/api/tasks/ai/detect-due-date", { title: title.trim() });
        const data = (await detect.json()) as { dueDate: string | null };
        if (data.dueDate) detectedDue = data.dueDate;
      } catch {
        /* ignore detect errors */
      } finally {
        setDetecting(false);
      }
    }
    createMutation.mutate({ title: title.trim(), dueDate: detectedDue, priority });
  };

  const busy = createMutation.isPending || detecting;

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        Press <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">N</kbd> to quick-create a personal task
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg border border-primary/30 bg-primary/5", busy && "opacity-70")}>
      <Input
        ref={inputRef}
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name — Enter to save, Esc to cancel"
        className="h-8 flex-1"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) { setOpen(false); setTitle(""); return; }
          if (e.key === "Enter" && title.trim() && !busy) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        data-testid="quick-create-input"
      />
      <div className="flex items-center gap-2">
        <Input type="date" className="h-8 w-full sm:w-36" value={dueDate} disabled={busy} onChange={(e) => setDueDate(e.target.value)} />
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 sm:flex-none"
          value={priority}
          disabled={busy}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
      </div>
    </div>
  );
}
