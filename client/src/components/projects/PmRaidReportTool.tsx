import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RAID Report — a read-only rollup across the 4 raw RAID logs (risk, issue,
 * assumption, dependency). The raw logs already exist and are mature
 * (RaiddLogTool); this is the aggregated, at-a-glance summary Peter's design
 * shows as its own screen, distinct from any one raw register. No new data,
 * no new table — reads the same /raidd endpoint the raw logs use, without a
 * type filter, and groups client-side.
 */

interface RaiddItem {
  id: number;
  type: string;
  code: string | null;
  title: string;
  status: string | null;
  priority: string | null;
  ownerName: string | null;
  archived: boolean | null;
  closed: boolean | null;
}

interface ToolProps {
  projectId: number;
}

const RAID_TYPES = ["risk", "assumption", "issue", "dependency"] as const;
const TYPE_LABEL: Record<(typeof RAID_TYPES)[number], string> = {
  risk: "Risks",
  assumption: "Assumptions",
  issue: "Issues",
  dependency: "Dependencies",
};

const OPEN_STATUSES = new Set(["open", "mitigating", "escalated", "in_progress"]);

export function PmRaidReportTool({ projectId }: ToolProps) {
  const { data: items = [], isLoading } = useQuery<RaiddItem[]>({
    queryKey: [`/api/pm/projects/${projectId}/raidd`],
  });

  const summary = useMemo(() => {
    return RAID_TYPES.map((type) => {
      const typeItems = items.filter((i) => i.type === type && !i.archived);
      const open = typeItems.filter((i) => !i.closed && OPEN_STATUSES.has((i.status || "").toLowerCase())).length;
      const highPriority = typeItems.filter((i) => (i.priority || "").toLowerCase() === "critical" || (i.priority || "").toLowerCase() === "high").length;
      const closed = typeItems.filter((i) => i.closed || (i.status || "").toLowerCase() === "resolved" || (i.status || "").toLowerCase() === "closed").length;
      return { type, items: typeItems, total: typeItems.length, open, highPriority, closed };
    });
  }, [items]);

  const topItems = useMemo(() => {
    return items
      .filter((i) => !i.archived && !i.closed)
      .filter((i) => (i.priority || "").toLowerCase() === "critical" || (i.priority || "").toLowerCase() === "high")
      .slice(0, 15);
  }, [items]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s) => (
          <Card key={s.type}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase">{TYPE_LABEL[s.type]}</div>
              <div className="text-2xl font-bold mt-1">{s.total}</div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span className={cn(s.open > 0 && "text-amber-500 font-medium")}>{s.open} open</span>
                <span className={cn(s.highPriority > 0 && "text-red-500 font-medium")}>{s.highPriority} high/critical</span>
                <span>{s.closed} closed</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">High / critical priority — open items across RAID</h3>
          </div>
          {topItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No open high or critical priority items.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topItems.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs text-muted-foreground capitalize">{i.type}</TableCell>
                    <TableCell className="font-medium">{i.title}</TableCell>
                    <TableCell>{i.status || "—"}</TableCell>
                    <TableCell>{i.priority || "—"}</TableCell>
                    <TableCell>{i.ownerName || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PmRaidReportTool;
