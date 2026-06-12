import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, Target, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ResourcesTabLoading, ResourcesTableSkeleton, ResourcesErrorState, ResourcesEmptyState } from "./ResourcesUi";

type PipelineItem = {
  id: number;
  name: string;
  client: string;
  stage: string;
  expectedCloseDate: string | null;
  totalValue: string | null;
  hasResourcePlan: boolean;
  planId: number | null;
  skillsSummary: string;
  demandDays: number;
};

type PipelineData = {
  items: PipelineItem[];
  totalDemandDays: number;
  byRole: Record<string, number>;
};

type Props = {
  onViewPlan?: (planId: number) => void;
  onGapAnalysis?: (planId: number) => void;
};

export function ResourcesPipelineTab({ onViewPlan, onGapAnalysis }: Props) {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<PipelineData>({
    queryKey: ["/api/resources/pipeline-view"],
  });

  const flagMutation = useMutation({
    mutationFn: (oppId: number) => apiRequest("POST", `/api/resources/pipeline/${oppId}/flag-capacity`, {}),
    onSuccess: () => toast({ title: "Capacity concern flagged to opportunity owner" }),
  });

  if (isLoading) return <ResourcesTableSkeleton rows={6} cols={8} />;

  if (isError) return <ResourcesErrorState message="Could not load pipeline view" onRetry={() => refetch()} />;

  const surplus = (data?.totalDemandDays ?? 0);

  return (
    <div className="space-y-4">
      <Card className={cn(surplus > 500 && "border-red-300 bg-red-50/50 dark:bg-red-950/20")}>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pipeline demand (Proposal + Negotiation)</p>
            <p className="text-2xl font-bold">{data?.totalDemandDays ?? 0} resource-days</p>
            {Object.entries(data?.byRole ?? {}).slice(0, 4).map(([role, days]) => (
              <span key={role} className="text-xs text-muted-foreground mr-3">{role}: {days}d</span>
            ))}
          </div>
          {surplus > 500 && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" /> Pipeline demand may exceed capacity
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3">Opportunity</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Stage</th>
                <th className="text-left p-3">Close</th>
                <th className="text-left p-3">Value</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Skills</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((o) => (
                <tr key={o.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-medium">{o.name}</td>
                  <td className="p-3 text-muted-foreground">{o.client}</td>
                  <td className="p-3"><Badge variant="outline">{o.stage}</Badge></td>
                  <td className="p-3">{o.expectedCloseDate ? new Date(o.expectedCloseDate).toLocaleDateString() : "—"}</td>
                  <td className="p-3">{o.totalValue ? `£${Number(o.totalValue).toLocaleString()}` : "—"}</td>
                  <td className="p-3">{o.hasResourcePlan ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                  <td className="p-3 text-muted-foreground max-w-[140px] truncate">{o.skillsSummary || "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {o.planId && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => onViewPlan?.(o.planId!)} title="View resource plan">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onGapAnalysis?.(o.planId!)} title="Gap analysis">
                            <Target className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => flagMutation.mutate(o.id)} title="Flag capacity concern">
                        <Flag className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No opportunities in Proposal/Negotiation stages</td></tr>
              )}
            </tbody>
          </table>
          {items.length > 0 && (
            <TablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Read-only view of CRM pipeline data. Resource managers cannot edit opportunities here.</p>
    </div>
  );
}
