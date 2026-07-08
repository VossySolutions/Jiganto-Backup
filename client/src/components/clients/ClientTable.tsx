import { useState } from "react";
import { useClientContext, type Client } from "@/hooks/use-client-context";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { ClientWorkspace } from "./types";
import { userDisplayName } from "./types";
import { TablePagination, type TablePaginationProps } from "@/components/TablePagination";

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
  sortKey: ClientSortKey;
  sortDir: ClientSortDir;
  onSort: (key: ClientSortKey) => void;
  onViewDetails: (c: ClientWorkspace) => void;
  onArchive: (c: ClientWorkspace) => void;
  onDelete: (c: ClientWorkspace) => void;
  onUnarchive: (c: ClientWorkspace) => void;
  canCreate: boolean;
  canDelete: boolean;
  pagination?: TablePaginationProps | null;
}

function SortIcon({ active, dir }: { active: boolean; dir: ClientSortDir }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
}

function engagementLabel(status?: string | null): string {
  if (!status) return "—";
  return status.replace(/_/g, " ");
}

export function ClientTable({
  clients,
  sortKey,
  sortDir,
  onSort,
  onViewDetails,
  onArchive,
  onDelete,
  onUnarchive,
  canCreate,
  canDelete,
  pagination,
}: Props) {
  const { setActiveClient, activeClient } = useClientContext();
  const [enteringId, setEnteringId] = useState<number | null>(null);

  const handleEnter = (client: ClientWorkspace) => {
    if (client.status === "archived" || client.status === "pending_delete" || enteringId === client.id) return;
    setEnteringId(client.id);
    void Promise.resolve(setActiveClient(client as Client)).finally(() => setEnteringId(null));
  };

  const sortHeader = (label: string, key: ClientSortKey) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
      onClick={() => onSort(key)}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </button>
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{sortHeader("Client", "name")}</TableHead>
              <TableHead>{sortHeader("Industry", "industry")}</TableHead>
              <TableHead>{sortHeader("Engagement", "engagementStatus")}</TableHead>
              <TableHead>{sortHeader("Account manager", "accountManager")}</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">{sortHeader("Projects", "projects")}</TableHead>
              <TableHead className="text-right">{sortHeader("At risk", "atRisk")}</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const isViewing = activeClient?.id === client.id;
              const isArchived = client.status === "archived";
              const isPendingDelete = client.status === "pending_delete";
              const tags = (client.tags ?? "")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);

              return (
                <TableRow
                  key={client.id}
                  data-testid={`client-row-${client.id}`}
                  className={cn(isViewing && "bg-primary/5")}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: client.color }}
                      >
                        {client.shortCode}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onViewDetails(client)}
                          className="font-semibold text-sm truncate text-left hover:text-primary block max-w-[200px]"
                        >
                          {client.name}
                        </button>
                        {isViewing && !isArchived && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">Viewing</Badge>
                        )}
                        {isArchived && (
                          <Badge variant="secondary" className="text-[10px] mt-0.5">Archived</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                    {client.industry || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs font-normal">
                      {engagementLabel(client.engagementStatus ?? client.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate">
                    {userDisplayName(client.accountManagerUser)}
                  </TableCell>
                  <TableCell>
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
                        <Badge variant="outline" className="text-[10px]">+{tags.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {client.projectCount ?? 0}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums font-medium",
                      (client.atRiskCount ?? 0) > 0 && "text-destructive",
                    )}
                  >
                    {client.atRiskCount ?? 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {!isArchived && !isPendingDelete && (
                        <Button
                          size="sm"
                          variant={isViewing ? "secondary" : "default"}
                          className="h-8 text-xs gap-1"
                          style={!isViewing ? { backgroundColor: client.color } : undefined}
                          disabled={isViewing || enteringId === client.id}
                          onClick={() => handleEnter(client)}
                        >
                          <ArrowRightCircle className="h-3.5 w-3.5" />
                          {enteringId === client.id ? "…" : "Enter"}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => onViewDetails(client)} className="gap-2 cursor-pointer">
                            <Pencil className="h-4 w-4" /> Edit client details
                          </DropdownMenuItem>
                          {isArchived && canCreate && (
                            <DropdownMenuItem onClick={() => onUnarchive(client)} className="gap-2 cursor-pointer">
                              <RotateCcw className="h-4 w-4" /> Restore workspace
                            </DropdownMenuItem>
                          )}
                          {(isArchived || isPendingDelete) && (
                            <DropdownMenuItem onClick={() => handleEnter(client)} className="gap-2 cursor-pointer">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {pagination ? <TablePagination {...pagination} /> : null}
    </div>
  );
}
