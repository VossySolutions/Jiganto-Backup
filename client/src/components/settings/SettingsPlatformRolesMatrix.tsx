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
import { Check, X, LayoutGrid } from "lucide-react";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
  ROLE_PERMISSION_LEVEL,
  showContextSwitcherForRole,
  isReadOnlyRole,
  canViewPmoMasterForRole,
  type PlatformRole,
} from "@shared/models/permissions";

function BoolCell({ value }: { value: boolean }) {
  return value ? (
    <Check className="h-4 w-4 text-status-green-foreground mx-auto" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  );
}

function isOrgAdminRole(role: PlatformRole): boolean {
  return role === "si_super_admin" || role === "client_jiganto_user" || role === "jiganto_staff";
}

export default function SettingsPlatformRolesMatrix() {
  return (
    <Card data-testid="platform-roles-matrix">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="h-4 w-4" />
          Platform role capabilities
        </CardTitle>
        <CardDescription>
          Read-only summary of what each platform role can do. Assign roles in the table above or
          when sending invitations.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Level</TableHead>
              <TableHead className="text-center">Context switcher</TableHead>
              <TableHead className="text-center">PMO master</TableHead>
              <TableHead className="text-center">Org admin</TableHead>
              <TableHead className="text-center">Read-only</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PLATFORM_ROLES.map((role) => (
              <TableRow key={role}>
                <TableCell className="font-medium">{PLATFORM_ROLE_LABELS[role]}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs capitalize">
                    {ROLE_PERMISSION_LEVEL[role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <BoolCell value={showContextSwitcherForRole(role)} />
                </TableCell>
                <TableCell>
                  <BoolCell value={canViewPmoMasterForRole(role)} />
                </TableCell>
                <TableCell>
                  <BoolCell value={isOrgAdminRole(role)} />
                </TableCell>
                <TableCell>
                  <BoolCell value={isReadOnlyRole(role)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
