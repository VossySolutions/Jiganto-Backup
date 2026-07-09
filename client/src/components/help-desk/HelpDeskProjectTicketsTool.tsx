import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ExternalLink,
  Plus,
  Ticket
} from "lucide-react";
import { TYPE_LABELS, slaBadgeClass, type SlaState } from "../service-desk/types";
import { HelpDeskEmptyState, HelpDeskTableSkeleton, HelpDeskTableWrap, HD_ACCENT } from "./HelpDeskUi";

interface TicketRow {
  id: number;
  ref: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  agentName?: string;
  slaState?: { resolution: string };
  effectiveResolutionDeadline?: string | null;
  updatedAt?: string;
}

export function HelpDeskProjectTicketsTool({ projectId }: { projectId: number }) {
  const { data: tickets = [], isLoading, isError } = useQuery<TicketRow[]>({
    queryKey: [`/api/help-desk/projects/${projectId}/tickets`],
    queryFn: () => fetchWithAuth(`/api/help-desk/projects/${projectId}/tickets`).then((r) => r.json()),
    enabled: !!projectId,
  });

  if (isLoading) return <HelpDeskTableSkeleton rows={5} cols={6} />;
  if (isError) {
    return (
      <Card className="rounded-2xl border-border/50">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Could not load support tickets. Ensure Help Desk is enabled.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="hd-project-tickets">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Ticket className="h-4 w-4" style={{ color: HD_ACCENT }} />
            Support Tickets
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Help Desk tickets linked to this project</p>
        </div>
        <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
          <a href={`/modules/help-desk?projectId=${projectId}`} target="_blank" rel="noopener noreferrer">
            <Plus className="h-4 w-4 mr-1" />Create Ticket
          </a>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <HelpDeskEmptyState
          icon={Ticket}
          title="No linked tickets"
          description="Create a Help Desk ticket with this project ID to track client support here."
        />
      ) : (
        <Card className="rounded-2xl border-border/50 overflow-hidden">
          <CardHeader className="px-4 sm:px-6 pb-2">
            <CardTitle className="text-sm">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <HelpDeskTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Agent</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                      <TableCell className="text-xs sm:text-sm max-w-[160px] truncate">{t.title}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs capitalize">{TYPE_LABELS[t.type as keyof typeof TYPE_LABELS] ?? t.type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] capitalize ${slaBadgeClass((t.slaState?.resolution ?? "none") as SlaState)}`}>
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{t.agentName ?? "—"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                          <a href={`/modules/help-desk?ticket=${t.id}`} target="_blank" rel="noopener noreferrer" title="Open in Help Desk">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </HelpDeskTableWrap>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
