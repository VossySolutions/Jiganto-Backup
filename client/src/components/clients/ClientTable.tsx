import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useClientContext, type Client } from "@/hooks/use-client-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowRightCircle,
  Archive,
  Eye,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { MondayBoardShell } from "@/components/board";
import type { ClientWorkspace } from "./types";
import { userDisplayName } from "./types";

export type ClientSortKey =
  | "name"
  | "industry"
  | "engagementStatus"
  | "accountManager"
  | "projects"
  | "atRisk";

export type ClientSortDir = "asc" | "desc";

interface Props {
  clients: readonly ClientWorkspace[];
  paginationResetKey: string;
  searchHighlightTerm?: string;
  pinFirstColumn?: boolean;
  onViewDetails: (c: ClientWorkspace) => void;
  onArchive: (c: ClientWorkspace) => void;
  onDelete: (c: ClientWorkspace) => void;
  onUnarchive: (c: ClientWorkspace) => void;
  canCreate: boolean;
  canDelete: boolean;
}

function engagementLabel(status?: string | null): string {
  if (!status) return "—";
  return status.replace(/_/g, " ");
}

export function ClientTable({
  clients,
  paginationResetKey,
  searchHighlightTerm,
  pinFirstColumn = true,
  onViewDetails,
  onArchive,
  onDelete,
  onUnarchive,
  canCreate,
  canDelete,
}: Props) {
  const { setActiveClient, activeClient } = useClientContext();
  const [enteringId, setEnteringId] = useState<number | null>(null);

  const handleEnter = (client: ClientWorkspace) => {
    if (client.status === "archived" || client.status === "pending_delete" || enteringId === client.id) return;
    setEnteringId(client.id);
    void Promise.resolve(setActiveClient(client as Client)).finally(() => setEnteringId(null));
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/clients/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/kpis"] });
    },
  });

  const columns: MondayColumnDef<ClientWorkspace>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Client",
        type: "text",
        accessor: "name",
        width: "240px",
        sticky: pinFirstColumn,
        editable: true,
        render: (client) => {
          const isViewing = activeClient?.id === client.id;
          const isArchived = client.status === "archived";
          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: client.color }}
              >
                {client.shortCode}
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(client);
                  }}
                  className="font-semibold text-sm truncate text-left hover:text-primary block max-w-[200px]"
                >
                  {client.name}
                </button>
                {isViewing && !isArchived && (
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    Viewing
                  </Badge>
                )}
                {isArchived && (
                  <Badge variant="secondary" className="text-[10px] mt-0.5">
                    Archived
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "industry",
        header: "Industry",
        type: "text",
        accessor: (row) => row.industry || "",
        width: "140px",
        editable: true,
        render: (client) => (
          <span className="text-sm text-muted-foreground truncate block max-w-[140px]">
            {client.industry || "—"}
          </span>
        ),
      },
      {
        id: "engagementStatus",
        header: "Engagement",
        type: "status",
        accessor: (row) => row.engagementStatus ?? row.status,
        width: "130px",
        editable: true,
        options: [
          { value: "active", label: "Active", color: "bg-[#00c875] text-white" },
          { value: "on_hold", label: "On hold", color: "bg-[#fdab3d] text-white" },
          { value: "completed", label: "Completed", color: "bg-[#579bfc] text-white" },
          { value: "archived", label: "Archived", color: "bg-[#c4c4c4] text-white" },
        ],
        render: (client) => (
          <Badge variant="outline" className="capitalize text-xs font-normal">
            {engagementLabel(client.engagementStatus ?? client.status)}
          </Badge>
        ),
      },
      {
        id: "accountManager",
        header: "Account manager",
        type: "person",
        accessor: (row) => userDisplayName(row.accountManagerUser),
        width: "160px",
        editable: false,
        render: (client) => (
          <span className="text-sm max-w-[160px] truncate block">
            {userDisplayName(client.accountManagerUser)}
          </span>
        ),
      },
      {
        id: "tags",
        header: "Tags",
        type: "text",
        accessor: (row) => row.tags || "",
        width: "180px",
        editable: true,
        render: (client) => {
          const tags = (client.tags ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          return (
            <div className="flex flex-wrap gap-1 max-w-[180px]">
              {tags.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                    {tag}
                  </Badge>
                ))
              )}
              {tags.length > 3 && (
                <Badge variant="outline" className="text-[10px]">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "projects",
        header: "Projects",
        type: "number",
        accessor: (row) => row.projectCount ?? 0,
        width: "90px",
        editable: false,
        render: (client) => (
          <span className="tabular-nums font-medium text-right block">{client.projectCount ?? 0}</span>
        ),
      },
      {
        id: "atRisk",
        header: "At risk",
        type: "number",
        accessor: (row) => row.atRiskCount ?? 0,
        width: "90px",
        editable: false,
        render: (client) => (
          <span
            className={cn(
              "tabular-nums font-medium text-right block",
              (client.atRiskCount ?? 0) > 0 && "text-destructive",
            )}
          >
            {client.atRiskCount ?? 0}
          </span>
        ),
      },
    ],
    [activeClient?.id, onViewDetails, pinFirstColumn],
  );

  return (
    <MondayBoardShell.Table
      columns={columns}
      data={[...clients]}
      searchHighlightTerm={searchHighlightTerm}
      paginationResetKey={paginationResetKey}
      totalCount={clients.length}
      columnWidthStorageKey="jiganto-clients-col-widths"
      emptyMessage="No clients match your filters."
      onOpenItem={onViewDetails}
      onCellEdit={(rowId, columnId, value) => {
        updateMutation.mutate({
          id: Number(rowId),
          payload: { [columnId]: value === "" ? null : value },
        });
      }}
      renderRowActions={(client) => {
        const isViewing = activeClient?.id === client.id;
        const isArchived = client.status === "archived";
        const isPendingDelete = client.status === "pending_delete";

        return (
          <div className="flex items-center gap-1 justify-end">
            {!isArchived && !isPendingDelete && (
              <Button
                size="sm"
                variant={isViewing ? "secondary" : "default"}
                className="h-8 text-xs gap-1"
                style={!isViewing ? { backgroundColor: client.color } : undefined}
                disabled={isViewing || enteringId === client.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnter(client);
                }}
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                {enteringId === client.id ? "…" : "Enter"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => onViewDetails(client)}
                  className="gap-2 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" /> Edit client details
                </DropdownMenuItem>
                {isArchived && canCreate && (
                  <DropdownMenuItem
                    onClick={() => onUnarchive(client)}
                    className="gap-2 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" /> Restore workspace
                  </DropdownMenuItem>
                )}
                {(isArchived || isPendingDelete) && (
                  <DropdownMenuItem
                    onClick={() => handleEnter(client)}
                    className="gap-2 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" /> View archived data
                  </DropdownMenuItem>
                )}
                {!isArchived && !isPendingDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onArchive(client)}
                      className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Archive className="h-4 w-4" /> Archive client
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && !isPendingDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(client)}
                    className="gap-2 cursor-pointer text-red-600 focus:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" /> Delete client
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }}
    />
  );
}
