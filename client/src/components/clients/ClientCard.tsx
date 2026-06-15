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
  MoreHorizontal,
  ArrowRightCircle,
  Pencil,
  Archive,
  Trash2,
  RotateCcw,
  Eye,
} from "lucide-react";
import type { ClientWorkspace } from "./types";
import { userDisplayName } from "./types";

interface Props {
  client: ClientWorkspace;
  onViewDetails: (c: ClientWorkspace) => void;
  onArchive: (c: ClientWorkspace) => void;
  onDelete: (c: ClientWorkspace) => void;
  onUnarchive: (c: ClientWorkspace) => void;
  canCreate: boolean;
  canDelete: boolean;
}

export function ClientCard({
  client,
  onViewDetails,
  onArchive,
  onDelete,
  onUnarchive,
  canCreate,
  canDelete,
}: Props) {
  const { setActiveClient, activeClient } = useClientContext();
  const [entering, setEntering] = useState(false);
  const isViewing = activeClient?.id === client.id;
  const isArchived = client.status === "archived";
  const isPendingDelete = client.status === "pending_delete";

  const handleEnter = () => {
    if (isArchived || isPendingDelete || entering) return;
    setEntering(true);
    void Promise.resolve(setActiveClient(client as Client)).catch(() => setEntering(false));
  };

  const handleViewArchived = () => {
    if (entering) return;
    setEntering(true);
    void Promise.resolve(setActiveClient(client as Client)).catch(() => setEntering(false));
  };

  return (
    <article
      data-testid={`client-card-${client.id}`}
      className={cn(
        "group relative rounded-2xl border bg-card overflow-hidden flex flex-col gap-4 p-4 sm:p-5",
        "transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        isViewing && "ring-2 ring-offset-2 ring-offset-background shadow-md",
      )}
      style={isViewing ? { borderColor: client.color + "55" } : undefined}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: client.color }}
      />

      <div className="flex items-start gap-3 pt-1">
        <div
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold text-white flex-shrink-0 shadow-md"
          style={{ backgroundColor: client.color }}
        >
          {client.shortCode}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onViewDetails(client)}
              className="font-semibold text-sm truncate text-left hover:text-primary transition-colors"
            >
              {client.name}
            </button>
            {isViewing && !isArchived && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ borderColor: client.color, color: client.color }}
              >
                Active
              </Badge>
            )}
            {isArchived && (
              <Badge variant="secondary" className="text-[10px]">Archived</Badge>
            )}
            {isPendingDelete && (
              <Badge variant="destructive" className="text-[10px]">Pending delete</Badge>
            )}
          </div>
          {client.industry && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.industry}</p>
          )}
          {client.accountManagerUser && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              AM: {userDisplayName(client.accountManagerUser)}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 -mr-1">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!isArchived && !isPendingDelete && (
              <DropdownMenuItem onClick={handleEnter} className="gap-2 cursor-pointer">
                <ArrowRightCircle className="h-4 w-4" /> Enter workspace
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onViewDetails(client)} className="gap-2 cursor-pointer">
              <Pencil className="h-4 w-4" /> Edit client details
            </DropdownMenuItem>
            {isArchived && canCreate && (
              <DropdownMenuItem onClick={() => onUnarchive(client)} className="gap-2 cursor-pointer">
                <RotateCcw className="h-4 w-4" /> Restore workspace
              </DropdownMenuItem>
            )}
            {!isArchived && !isPendingDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onArchive(client)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <Archive className="h-4 w-4" /> Archive client
                </DropdownMenuItem>
              </>
            )}
            {canDelete && !isPendingDelete && (
              <DropdownMenuItem onClick={() => onDelete(client)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> Delete client
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 border border-border/50">
          <p className="text-muted-foreground">Projects</p>
          <p className="font-semibold mt-0.5 text-base tabular-nums">{client.projectCount ?? 0}</p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 border border-border/50">
          <p className="text-muted-foreground">At Risk</p>
          <p className={cn("font-semibold mt-0.5 text-base tabular-nums", (client.atRiskCount ?? 0) > 0 ? "text-destructive" : "")}>
            {client.atRiskCount ?? 0}
          </p>
        </div>
      </div>

      {isArchived || isPendingDelete ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 h-10"
          onClick={handleViewArchived}
        >
          <Eye className="h-4 w-4" />
          View archived data
        </Button>
      ) : (
        <Button
          size="sm"
          className={cn("w-full gap-2 h-10 text-white shadow-sm", isViewing && "opacity-90 cursor-default")}
          style={{ backgroundColor: client.color }}
          onClick={isViewing ? undefined : handleEnter}
          disabled={isViewing || entering}
        >
          <ArrowRightCircle className="h-4 w-4" />
          {entering ? "Entering…" : isViewing ? "Currently viewing" : "Enter workspace"}
        </Button>
      )}
    </article>
  );
}
