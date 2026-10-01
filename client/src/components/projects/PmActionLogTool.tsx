import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Action Log — lightweight, distinct from the RAID logs (risks/issues/
 * assumptions/dependencies) which have their own dedicated register with a
 * full workflow. This is for the day-to-day "who owes what by when" items
 * that come out of meetings, not formal RAID entries. Stored on the
 * project's metadata rather than a new table — same pattern as the
 * Stakeholder and SoW tools, appropriate for a simple list with no
 * cross-project reporting need yet.
 */

interface ActionItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: "open" | "in_progress" | "done";
  createdAt: string;
}

interface ToolProps {
  projectId: number;
  project?: any;
}

const STATUS_LABEL: Record<ActionItem["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
};

export function PmActionLogTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const actions = (meta.actionLog as ActionItem[]) || [];
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");

  const isLoading = !project;

  const save = useMutation({
    mutationFn: (next: ActionItem[]) => apiRequest("PUT", `/api/pm/projects/${projectId}`, { metadata: { ...meta, actionLog: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] }),
  });

  const addAction = () => {
    const next: ActionItem = {
      id: String(Date.now()),
      title,
      owner,
      dueDate,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    save.mutate([next, ...actions]);
    setTitle("");
    setOwner("");
    setDueDate("");
    toast({ title: "Action added" });
  };

  const setStatus = (id: string, status: ActionItem["status"]) => {
    save.mutate(actions.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const removeAction = (id: string) => {
    save.mutate(actions.filter((a) => a.id !== id));
  };

  const today = Date.now();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Action</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen…" className="mt-1" />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Owner</label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Due</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
          </div>
          <Button size="sm" disabled={!title.trim() || save.isPending} onClick={addAction}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No actions logged yet.</TableCell></TableRow>
              ) : actions.map((a) => {
                const overdue = a.status !== "done" && a.dueDate && new Date(a.dueDate).getTime() < today;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.owner || "—"}</TableCell>
                    <TableCell className={cn("text-xs", overdue && "text-destructive font-medium")}>
                      {a.dueDate || "—"}
                    </TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={(v) => setStatus(a.id, v as ActionItem["status"])}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as ActionItem["status"][]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeAction(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default PmActionLogTool;
