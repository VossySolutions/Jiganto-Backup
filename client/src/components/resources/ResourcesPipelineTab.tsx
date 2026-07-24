import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, Target, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
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
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebouncedValue(localSearch);
  const [pinName, setPinName] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("resources-pipeline-pin-name") !== "0";
  });
  const { data, isLoading, isError, refetch } = useQuery<PipelineData>({
    queryKey: ["/api/resources/pipeline-view"],
  });

  const items = data?.items ?? [];
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      o.client.toLowerCase().includes(q) ||
      o.stage.toLowerCase().includes(q),
    );
  }, [items, debouncedSearch]);

  const flagMutation = useMutation({
    mutationFn: (oppId: number) => apiRequest("POST", `/api/resources/pipeline/${oppId}/flag-capacity`, {}),
    onSuccess: () => {
      toast({ title: "Capacity concern flagged to opportunity owner" });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/pipeline-view"] });
    },
  });

  const mondayColumns: MondayColumnDef<PipelineItem>[] = useMemo(() => [
    {
      id: "name",
      header: "Opportunity",
      type: "text",
      accessor: "name",
      width: "220px",
      sticky: pinName,
      editable: false, // derived from CRM opportunities — no write API
      render: (o) => <span className="font-medium">{o.name}</span>,
    },
    {
      id: "client",
      header: "Client",
      type: "text",
      accessor: "client",
      width: "160px",
      editable: false, // derived from CRM opportunities — no write API
      render: (o) => <span className="text-sm text-muted-foreground">{o.client}</span>,
    },
    {
      id: "stage",
      header: "Stage",
      type: "status",
      accessor: "stage",
      width: "130px",
      editable: false, // derived from CRM opportunities — no write API
      render: (o) => <Badge variant="outline">{o.stage}</Badge>,
    },
    {
      id: "close",
      header: "Close",
      type: "date",
      accessor: "expectedCloseDate",
      width: "110px",
      editable: false, // derived from CRM opportunities — no write API
      render: (o) => (
        <span className="text-sm">
          {o.expectedCloseDate ? new Date(o.expectedCloseDate).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      id: "value",
      header: "Value",
      type: "currency",
      accessor: "totalValue",
      width: "120px",
      editable: false,
      render: (o) => (
        <span className="text-sm tabular-nums">
          {o.totalValue ? `£${Number(o.totalValue).toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      type: "status",
      accessor: (row) => row.hasResourcePlan,
      width: "90px",
      editable: false,
      render: (o) => (o.hasResourcePlan ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>),
    },
    {
      id: "skills",
      header: "Skills",
      type: "text",
      accessor: "skillsSummary",
      width: "160px",
      editable: false,
      render: (o) => <span className="text-sm text-muted-foreground truncate block max-w-[160px]">{o.skillsSummary || "—"}</span>,
    },
  ], [pinName]);

  if (isLoading) return <ResourcesTableSkeleton rows={6} cols={8} />;

  if (isError) return <ResourcesErrorState message="Could not load pipeline view" onRetry={() => refetch()} />;

  const surplus = (data?.totalDemandDays ?? 0);

  const PIPELINE_CSV_HEADERS = ["Opportunity", "Client", "Stage", "Close", "Value", "Plan", "Skills"];

  const exportPipeline = () => {
    const rows = filteredItems.map((o) => [
      o.name || "",
      o.client || "",
      o.stage || "",
      o.expectedCloseDate ? new Date(o.expectedCloseDate).toLocaleDateString() : "",
      o.totalValue != null ? String(o.totalValue) : "",
      o.hasResourcePlan ? "Yes" : "No",
      o.skillsSummary || "",
    ]);
    downloadBoardCsv(`pipeline-${new Date().toISOString().split("T")[0]}.csv`, PIPELINE_CSV_HEADERS, rows);
    toast({ title: "Pipeline exported to CSV" });
  };

  const downloadPipelineTemplate = () => {
    downloadImportTemplateCsv("pipeline-import-template.csv", PIPELINE_CSV_HEADERS, PIPELINE_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => toast({ title: "Import is not available for this table yet" });

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

      <MondayBoardShell.Legacy
        storageKey="jiganto-resources-pipeline"
        entityType="resource_pipeline"
        stateHook={useMondayBoardShellState}
        filterMatcher={matchBoardFilterValue}
      >
      <MondayBoardShell.Toolbar
        newLabel="Pipeline"
        searchValue={localSearch}
        onSearchChange={setLocalSearch}
        pinActive={pinName}
        onPinToggle={() => {
          setPinName((v) => {
            const next = !v;
            localStorage.setItem("resources-pipeline-pin-name", next ? "1" : "0");
            return next;
          });
        }}
        pinTitle={pinName ? "Unpin Opportunity column" : "Pin Opportunity column"}
        onExport={exportPipeline}
        onDownloadTemplate={downloadPipelineTemplate}
        onPaste={importUnavailable}
        onImport={importUnavailable}
        testId="resources-pipeline-toolbar"
      />

      <MondayBoardShell.Table
        columns={mondayColumns}
        data={filteredItems}
        emptyMessage="No opportunities in Proposal/Negotiation stages"
        searchHighlightTerm={debouncedSearch}
        columnWidthStorageKey="jiganto-resources-pipeline-col-widths"
        paginationResetKey={`${items.length}|${debouncedSearch}`}
        totalCount={items.length}
        renderRowActions={(o) => (
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
        )}
      />
      </MondayBoardShell.Legacy>

      <p className="text-xs text-muted-foreground">Read-only view of CRM pipeline data. Resource managers cannot edit opportunities here.</p>
    </div>
  );
}
