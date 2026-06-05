import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { canViewSettingsAudit } from "@/lib/settings-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, Activity } from "lucide-react";
import {
  ORG_AUDIT_ACTION_LABELS,
  type OrgAuditAction,
} from "@shared/models/permissions";

type ImpersonationRow = {
  id: number;
  staffUserId: string;
  targetUserId: string;
  approvalStatus: string;
  reason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
  staffEmail: string | null;
  staffName: string | null;
  targetEmail: string | null;
  targetName: string | null;
};

type OrgEventRow = {
  id: number;
  action: string;
  targetEmail: string | null;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  actorEmail: string | null;
  actorName: string | null;
};

interface Props {
  tenantId: number;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-status-green text-status-green-foreground",
    ended: "bg-muted text-muted-foreground",
    approved: "bg-status-blue text-status-blue-foreground",
    pending: "bg-status-amber text-status-amber-foreground",
    denied: "bg-status-red text-status-red-foreground",
  };
  return (
    <Badge variant="secondary" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function actionLabel(action: string): string {
  return ORG_AUDIT_ACTION_LABELS[action as OrgAuditAction] ?? action;
}

function eventDetail(row: OrgEventRow): string {
  const meta = row.metadata ?? {};
  const parts: string[] = [];
  if (meta.platformRole) parts.push(String(meta.platformRole));
  if (meta.clientId) parts.push(`client #${meta.clientId}`);
  if (meta.requestId) parts.push(String(meta.requestId));
  if (row.targetEmail) parts.push(row.targetEmail);
  return parts.join(" · ") || "—";
}

export default function SettingsStaffAuditTab({ tenantId }: Props) {
  const { permissions } = usePermissions();
  const showImpersonation = canViewSettingsAudit(
    permissions?.platformRole,
    permissions?.isJigantoStaff,
  );

  const impersonationQuery = useQuery({
    queryKey: ["/api/settings/audit/impersonation", tenantId],
    enabled: showImpersonation,
    queryFn: async () => {
      const res = await fetchWithAuth(
        `/api/settings/audit/impersonation?orgId=${tenantId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ logs: ImpersonationRow[] }>;
    },
  });

  const orgEventsQuery = useQuery({
    queryKey: ["/api/settings/audit/org-events", tenantId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/settings/audit/org-events?orgId=${tenantId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ events: OrgEventRow[] }>;
    },
  });

  const impersonationLogs = impersonationQuery.data?.logs ?? [];
  const orgEvents = orgEventsQuery.data?.events ?? [];

  return (
    <div className="space-y-6" data-testid="settings-audit-tab">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Organisation activity
          </CardTitle>
          <CardDescription>
            Invitations, platform role changes, and client workspace grants performed by org
            administrators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgEventsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : orgEventsQuery.error ? (
            <p className="text-sm text-muted-foreground">
              Activity log unavailable. Run{" "}
              <code className="text-xs">scripts/sql/org-audit-events.sql</code> if the table is
              missing.
            </p>
          ) : orgEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organisation events recorded yet.</p>
          ) : (
            <ScrollArea className="h-[min(360px,45vh)]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgEvents.map((row) => (
                      <TableRow key={row.id} data-testid={`org-audit-${row.id}`}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatWhen(row.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.actorName || row.actorEmail || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{actionLabel(row.action)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                          {eventDetail(row)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {showImpersonation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Staff impersonation
            </CardTitle>
            <CardDescription>
              Jiganto staff support sessions. Only visible to organisation owners and Jiganto staff.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {impersonationQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : impersonationLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No impersonation events recorded yet.</p>
            ) : (
              <ScrollArea className="h-[min(320px,40vh)]">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impersonationLogs.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatWhen(row.startedAt ?? row.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.staffName || row.staffEmail || row.staffUserId}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.targetName || row.targetEmail || row.targetUserId}
                          </TableCell>
                          <TableCell>{statusBadge(row.approvalStatus)}</TableCell>
                          <TableCell className="text-sm max-w-[180px] truncate">
                            {row.reason || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
