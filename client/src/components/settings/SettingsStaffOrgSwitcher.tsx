import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchWithAuth } from "@/lib/queryClient";
import {
  getStaffOrgOverride,
  setStaffOrgOverride,
} from "@/lib/staff-org-scope";
import { PLATFORM_ROLE_LABELS } from "@shared/models/permissions";
import type { Tenant } from "@shared/schema";

/**
 * Lets Jiganto staff (or multi-org SI admins) target ?tenantId= on API calls.
 */
export default function SettingsStaffOrgSwitcher() {
  const queryClient = useQueryClient();
  const { permissions, isJigantoStaff } = usePermissions();
  const orgRoles = permissions?.orgRoles ?? [];
  const show =
    isJigantoStaff ||
    (orgRoles.length > 1 && permissions?.platformRole === "si_super_admin");

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants", "staff-switcher"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/tenants");
      if (!res.ok) throw new Error("Failed to load organisations");
      return res.json();
    },
    enabled: show && isJigantoStaff,
    staleTime: 120_000,
  });

  const override = getStaffOrgOverride();
  const effective = override ?? permissions?.orgId;

  useEffect(() => {
    if (!show && override != null) {
      setStaffOrgOverride(null);
      void queryClient.invalidateQueries();
    }
  }, [show, override, queryClient]);

  if (!show) return null;

  const options = isJigantoStaff
    ? tenants.map((t) => ({ orgId: t.id, label: t.name }))
    : orgRoles.map((r) => ({
        orgId: r.orgId,
        label: `Org #${r.orgId} — ${PLATFORM_ROLE_LABELS[r.platformRole]}`,
      }));

  if (options.length === 0 && !isJigantoStaff) return null;
  if (options.length <= 1 && !isJigantoStaff) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 pb-2"
      data-testid="settings-staff-org-switcher"
    >
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Label className="text-xs text-muted-foreground shrink-0">Organisation context</Label>
      <Select
        value={effective != null ? String(effective) : undefined}
        onValueChange={(v) => {
          const id = Number(v);
          setStaffOrgOverride(id === permissions?.orgId ? null : id);
          void queryClient.invalidateQueries();
        }}
      >
        <SelectTrigger className="h-8 w-[260px]" data-testid="select-staff-org">
          <SelectValue placeholder="Select organisation" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.orgId} value={String(o.orgId)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
