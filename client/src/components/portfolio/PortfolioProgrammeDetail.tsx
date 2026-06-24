import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUpRight } from "lucide-react";
import { formatBudget } from "./rag-utils";
import type { ProgrammeListItem } from "./types";

type Detail = ProgrammeListItem & {
  health: number;
  milestones: { id: number; name: string; targetDate: string | null; ragStatus: string | null; status: string | null }[];
  raidd: { id: number; type: string; title: string; status: string | null; priority: string | null }[];
};

export function PortfolioProgrammeDetail({ programmeId, source }: { programmeId: number; source: "program" | "project" }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<Detail>({
    queryKey: [`/api/portfolio/programmes/${source}/${programmeId}`],
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/30 border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle>{data.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{data.description}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted-foreground text-xs block">Health Score</span><span className="font-bold text-lg">{data.health}%</span></div>
          <div><span className="text-muted-foreground text-xs block">Budget</span><span className="font-mono">{formatBudget(data.budget)}</span></div>
          <div><span className="text-muted-foreground text-xs block">Timeline</span><span className="font-mono text-xs">{data.startDate || "?"} → {data.endDate || "?"}</span></div>
          <div><span className="text-muted-foreground text-xs block">RAG</span><Badge>{data.ragStatus}</Badge></div>
        </CardContent>
      </Card>

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-sm">Child Projects</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.children.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-muted/30">
              <div>
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.clientName} · {c.progress}% · RAG {c.ragStatus}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLocation(`/modules/projects/${c.id}`)}><ArrowUpRight className="h-4 w-4" /></Button>
            </div>
          ))}
          {!data.children.length && <p className="text-sm text-muted-foreground text-center py-6">No child projects linked</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/30">
          <CardHeader><CardTitle className="text-sm">Programme Milestones</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.milestones.slice(0, 8).map((m) => (
              <div key={m.id} className="flex justify-between border-b border-border/20 pb-2">
                <span>{m.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{m.targetDate}</span>
              </div>
            ))}
            {!data.milestones.length && <p className="text-muted-foreground text-center py-4">No milestones</p>}
          </CardContent>
        </Card>
        <Card className="border-border/30">
          <CardHeader><CardTitle className="text-sm">Programme RAID</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.raidd.slice(0, 8).map((r) => (
              <div key={r.id} className="flex justify-between border-b border-border/20 pb-2">
                <span className="capitalize">{r.type}: {r.title}</span>
                <Badge variant="outline" className="text-[10px]">{r.priority}</Badge>
              </div>
            ))}
            {!data.raidd.length && <p className="text-muted-foreground text-center py-4">No RAID items</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
