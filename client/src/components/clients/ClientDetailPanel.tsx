import { formatClientDate } from "@/lib/client-workspace-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Users, Settings2, Pencil } from "lucide-react";
import type { ClientWorkspace } from "./types";
import { userDisplayName } from "./types";

interface Props {
  client: ClientWorkspace | null;
  open: boolean;
  onClose: () => void;
  onEdit: (c: ClientWorkspace) => void;
  onManageMembers: (c: ClientWorkspace) => void;
  onModuleVisibility: (c: ClientWorkspace) => void;
  canConfigure: boolean;
}

export function ClientDetailPanel({
  client,
  open,
  onClose,
  onEdit,
  onManageMembers,
  onModuleVisibility,
  canConfigure,
}: Props) {
  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3 pr-6">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0"
              style={{ backgroundColor: client.color }}
            >
              {client.shortCode}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{client.name}</SheetTitle>
              <SheetDescription className="truncate">{client.industry || "Client workspace"}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">{client.engagementStatus?.replace("_", " ") ?? client.status}</Badge>
            {client.tags && <Badge variant="secondary">{client.tags}</Badge>}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-4">
            <DetailItem label="Created" value={formatClientDate(client.createdAt)} />
            <DetailItem label="Members" value={String(client.memberCount ?? 0)} />
            <DetailItem label="Engagement start" value={client.contractStart || "—"} />
            <DetailItem label="Engagement end" value={client.contractEnd || "—"} />
            <DetailItem label="Projects" value={String(client.projectCount ?? 0)} />
            <DetailItem label="At risk" value={String(client.atRiskCount ?? 0)} />
            <DetailItem label="Account manager" value={userDisplayName(client.accountManagerUser)} />
            <DetailItem label="Created by" value={userDisplayName(client.createdByUser)} />
          </dl>

          {client.website && (
            <p className="text-xs break-all">
              <span className="text-muted-foreground">Website: </span>
              <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-primary underline">
                {client.website}
              </a>
            </p>
          )}

          {client.notes && (
            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
              {client.notes}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-2 justify-start w-full" onClick={() => onEdit(client)}>
              <Pencil className="h-4 w-4" /> Edit details
            </Button>
            <Button variant="outline" size="sm" className="gap-2 justify-start w-full" onClick={() => onManageMembers(client)}>
              <Users className="h-4 w-4" /> Manage members ({client.memberCount ?? 0})
            </Button>
            {canConfigure && (
              <Button variant="outline" size="sm" className="gap-2 justify-start w-full" onClick={() => onModuleVisibility(client)}>
                <Settings2 className="h-4 w-4" /> Module visibility
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium mt-0.5 break-words">{value}</dd>
    </div>
  );
}
