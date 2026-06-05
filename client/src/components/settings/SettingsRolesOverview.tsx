import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Shield, Layers } from "lucide-react";

interface Props {
  canManagePlatformRoles: boolean;
}

export default function SettingsRolesOverview({ canManagePlatformRoles }: Props) {
  return (
    <Card data-testid="roles-overview">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Info className="h-5 w-5" />
          Roles & permissions
        </CardTitle>
        <CardDescription>
          Jiganto uses two layers. Assign <strong>platform roles</strong> first — they control
          organisation access, the workspace switcher, and read-only behaviour.{" "}
          <strong>Module roles (legacy)</strong> are optional templates for per-module CRUD on
          user profiles.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Shield className="h-4 w-4 text-status-purple-foreground" />
            Platform roles
            {canManagePlatformRoles ? (
              <Badge variant="secondary" className="text-xs">Primary</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Admin only</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            One role per user per organisation (SI Super Admin, Consultant/PM, Client users, etc.).
            Managed below when you have org admin access.
          </p>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Layers className="h-4 w-4 text-status-blue-foreground" />
            Module roles (legacy)
            <Badge variant="outline" className="text-xs">Optional</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Named permission bundles (Dashboard, CRM, Projects, …) attached to profiles and
            invitations. Being replaced by platform roles and workspace grants over time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
