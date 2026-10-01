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

/**
 * RTM (Requirements Traceability Matrix) — requirement ↔ deliverable ↔
 * test-case linkage. No equivalent existed: WBS tracks work breakdown,
 * Test Tracker (via Test Management module) tracks test execution, but
 * nothing ties a requirement through to what delivers it and what proves
 * it. Kept as its own simple table on project metadata rather than forcing
 * a join across PM/WBS and Test Management's separate project space —
 * those two aren't reliably the same project (see PmTestTrackerTool's
 * name-matching workaround), so free-text linkage is the honest option
 * here rather than a fragile foreign key.
 */

interface RtmRow {
  id: string;
  requirement: string;
  deliverable: string;
  testCaseRef: string;
  status: "not_started" | "in_progress" | "verified";
}

interface ToolProps {
  projectId: number;
  project?: any;
}

const STATUS_LABEL: Record<RtmRow["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  verified: "Verified",
};

export function PmRtmTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const rows = (meta.rtm as RtmRow[]) || [];
  const [requirement, setRequirement] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [testCaseRef, setTestCaseRef] = useState("");

  const isLoading = !project;

  const save = useMutation({
    mutationFn: (next: RtmRow[]) => apiRequest("PUT", `/api/pm/projects/${projectId}`, { metadata: { ...meta, rtm: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] }),
  });

  const addRow = () => {
    const next: RtmRow = { id: String(Date.now()), requirement, deliverable, testCaseRef, status: "not_started" };
    save.mutate([...rows, next]);
    setRequirement("");
    setDeliverable("");
    setTestCaseRef("");
    toast({ title: "Requirement added" });
  };

  const setStatus = (id: string, status: RtmRow["status"]) => {
    save.mutate(rows.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const removeRow = (id: string) => save.mutate(rows.filter((r) => r.id !== id));

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const verifiedCount = rows.filter((r) => r.status === "verified").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Requirements", value: rows.length },
          { label: "Verified", value: verifiedCount },
          { label: "Coverage", value: rows.length ? `${Math.round((verifiedCount / rows.length) * 100)}%` : "—" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Requirement</label>
            <Input value={requirement} onChange={(e) => setRequirement(e.target.value)} placeholder="What's required…" className="mt-1" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Delivered by</label>
            <Input value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="Deliverable / task" className="mt-1" />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Test case ref</label>
            <Input value={testCaseRef} onChange={(e) => setTestCaseRef(e.target.value)} placeholder="e.g. TC-042" className="mt-1" />
          </div>
          <Button size="sm" disabled={!requirement.trim() || save.isPending} onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                <TableHead>Delivered by</TableHead>
                <TableHead>Test case</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No requirements tracked yet.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.requirement}</TableCell>
                  <TableCell>{r.deliverable || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.testCaseRef || "—"}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => setStatus(r.id, v as RtmRow["status"])}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as RtmRow["status"][]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRow(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default PmRtmTool;
