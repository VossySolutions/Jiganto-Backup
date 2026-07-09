import { useQuery, useMutation } from "@tanstack/react-query";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, Target, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ResourcesTableSkeleton,
  ResourcesErrorState
} from "./ResourcesUi";

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

  const items = data?.items ?? [];
  const pagination = useTablePagination(items, { resetKey: items.length, enabled: !isLoading && !isError });

  const flagMutation = useMutation({
    mutationFn: (oppId: number) => apiRequest("POST", `/api/resources/pipeline/${oppId}/flag-capacity`, {}),
    onSuccess: () => {
      toast({ title: "Capacity concern flagged to opportunity owner" });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/pipeline-view"] });
    },
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
          <table className="w-full text-sm text-gray-700 dark:text-foreground">
            <thead>
              <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Opportunity</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Client</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Stage</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Close</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Value</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Plan</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Skills</th>
                <th className="px-3 py-2.5 text-right align-middle font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((o) => (
                <tr key={o.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2.5 align-middle font-medium">{o.name}</td>
                  <td className="px-3 py-2.5 align-middle text-muted-foreground">{o.client}</td>
                  <td className="px-3 py-2.5 align-middle"><Badge variant="outline">{o.stage}</Badge></td>
                  <td className="px-3 py-2.5 align-middle">{o.expectedCloseDate ? new Date(o.expectedCloseDate).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2.5 align-middle">{o.totalValue ? `£${Number(o.totalValue).toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2.5 align-middle">{o.hasResourcePlan ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                  <td className="px-3 py-2.5 align-middle text-muted-foreground max-w-[140px] truncate">{o.skillsSummary || "—"}</td>
                  <td className="px-3 py-2.5 align-middle text-right">
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
