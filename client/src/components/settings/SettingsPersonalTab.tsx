import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentOrganisation } from "@/hooks/use-jiganto";
import { useTheme } from "@/hooks/use-theme";
import { organisationDisplayName } from "@/lib/settings-access";
import { PLATFORM_ROLE_LABELS } from "@shared/models/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Building2, Sun, Moon, Monitor, Shield } from "lucide-react";
import { supabaseAuthEnabled } from "@/lib/supabase";
import SettingsNotificationPreferences from "@/components/settings/SettingsNotificationPreferences";
import SettingsPersonalDataPrivacy from "@/components/settings/SettingsPersonalDataPrivacy";
import { cn } from "@/lib/utils";

export default function SettingsPersonalTab() {
  const { user } = useAuth();
  const { platformRole, isReadOnly } = usePermissions();
  const { data: organisation } = useCurrentOrganisation();
  const { theme, setTheme } = useTheme();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "User";
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U";
  const orgLabel = organisationDisplayName(organisation) ?? organisation?.name;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card data-testid="settings-personal-profile">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Your account details (managed through your sign-in provider)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profileImageUrl ?? undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-lg truncate">{fullName}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              {platformRole && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="secondary">{PLATFORM_ROLE_LABELS[platformRole]}</Badge>
                  {isReadOnly && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Read-only
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {orgLabel && (
        <Card data-testid="settings-personal-org">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Organisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{orgLabel}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Company name is managed by your organisation administrator in Settings → Organization.
            </p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="settings-personal-security">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Security
          </CardTitle>
          <CardDescription>
            {supabaseAuthEnabled
              ? "Password and multi-factor authentication are managed in your Supabase sign-in account."
              : "Sign-in is managed by your organisation's identity provider."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            To change your password, use the reset flow on the sign-in page or your IdP admin console.
          </p>
          <p>
            If you were invited to Jiganto, open the invite link while signed in with the same email
            address shown above.
          </p>
        </CardContent>
      </Card>

      <SettingsNotificationPreferences />

      <SettingsPersonalDataPrivacy />

      <Card data-testid="settings-personal-display">
        <CardHeader>
          <CardTitle className="text-base">Display</CardTitle>
          <CardDescription>Theme preference for this browser</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Theme</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "light" as const, label: "Light", icon: Sun },
                { value: "dark" as const, label: "Dark", icon: Moon },
                { value: "system" as const, label: "System", icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant={theme === value ? "default" : "outline"}
                size="sm"
                className={cn("gap-2")}
                onClick={() => setTheme(value)}
                data-testid={`theme-${value}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
