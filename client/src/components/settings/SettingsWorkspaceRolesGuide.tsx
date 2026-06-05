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
import { Users } from "lucide-react";
import { PLATFORM_ROLE_LABELS, type PlatformRole } from "@shared/models/permissions";

/** Spec workspace role names mapped to platform roles (reference until dedicated workspace RBAC ships). */
const WORKSPACE_ROLE_MAP: {
  workspaceRole: string;
  platformRole: PlatformRole;
  notes: string;
}[] = [
  {
    workspaceRole: "Organisation owner",
    platformRole: "si_super_admin",
    notes: "Full SI org administration",
  },
  {
    workspaceRole: "Consultant / PM",
    platformRole: "si_consultant_pm",
    notes: "Cross-client delivery; use workspace grants to limit clients",
  },
  {
    workspaceRole: "Client workspace admin",
    platformRole: "client_jiganto_user",
    notes: "Manages users & customers in their org",
  },
  {
    workspaceRole: "Project team member",
    platformRole: "client_project_user",
    notes: "Locked to one client workspace",
  },
  {
    workspaceRole: "Executive viewer",
    platformRole: "client_executive",
    notes: "Read-only dashboards in workspace",
  },
];

export default function SettingsWorkspaceRolesGuide() {
  return (
    <Card data-testid="workspace-roles-guide">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Workspace roles (reference)
        </CardTitle>
        <CardDescription>
          Product spec workspace roles map to <strong>platform roles</strong> today. Notion-style
          workspace member roles (<code className="text-xs">workspace_members.role</code>) are separate
          and used inside document workspaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Spec workspace role</TableHead>
              <TableHead>Platform role to assign</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {WORKSPACE_ROLE_MAP.map((row) => (
              <TableRow key={row.workspaceRole}>
                <TableCell className="font-medium">{row.workspaceRole}</TableCell>
                <TableCell>
                  <Badge variant="outline">{PLATFORM_ROLE_LABELS[row.platformRole]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
