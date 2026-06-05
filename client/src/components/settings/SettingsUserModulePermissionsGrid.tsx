import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SETTINGS_MODULE_KEYS } from "@shared/models/module-access";
import type { UserRole, ModulePermissions } from "@shared/schema";

export type PermissionRow = {
  moduleKey: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

function emptyPermissions(): PermissionRow[] {
  return SETTINGS_MODULE_KEYS.map((mod) => ({
    moduleKey: mod.key,
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
  }));
}

function fromRoleTemplate(permissions: ModulePermissions | null | undefined): PermissionRow[] {
  return SETTINGS_MODULE_KEYS.map((mod) => {
    const p = permissions?.[mod.key];
    const write = !!p?.write;
    return {
      moduleKey: mod.key,
      canRead: !!p?.read,
      canCreate: write,
      canUpdate: write,
      canDelete: write,
    };
  });
}

interface Props {
  permissions: PermissionRow[];
  onChange: (next: PermissionRow[]) => void;
  roles?: UserRole[];
  disabled?: boolean;
}

export default function SettingsUserModulePermissionsGrid({
  permissions,
  onChange,
  roles = [],
  disabled,
}: Props) {
  const toggle = (moduleKey: string, field: keyof Omit<PermissionRow, "moduleKey">, value: boolean) => {
    onChange(
      permissions.map((p) =>
        p.moduleKey === moduleKey ? { ...p, [field]: value } : p,
      ),
    );
  };

  const grantAllRead = () => {
    onChange(
      permissions.map((p) => ({
        ...p,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      })),
    );
  };

  const grantReadWrite = () => {
    onChange(
      permissions.map((p) => ({
        ...p,
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: false,
      })),
    );
  };

  const clearAll = () => onChange(emptyPermissions());

  const copyFromRole = (roleId: string) => {
    const role = roles.find((r) => String(r.id) === roleId);
    if (!role) return;
    onChange(fromRoleTemplate((role.permissions as ModulePermissions) || {}));
  };

  const rowFor = (moduleKey: string): PermissionRow => {
    return (
      permissions.find((p) => p.moduleKey === moduleKey) ?? {
        moduleKey,
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
      }
    );
  };

  return (
    <div className="space-y-3" data-testid="user-module-permissions-grid">
      <div className="flex flex-wrap items-end gap-2 justify-between">
        <h3 className="text-sm font-semibold">Module permissions</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={grantAllRead} disabled={disabled}>
            All read
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={grantReadWrite} disabled={disabled}>
            All read/write
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={disabled}>
            Clear
          </Button>
        </div>
      </div>
      {roles.length > 0 && (
        <div className="flex items-center gap-2 max-w-xs">
          <Label className="text-xs shrink-0">Copy from role</Label>
          <Select onValueChange={copyFromRole} disabled={disabled}>
            <SelectTrigger data-testid="select-copy-permissions-role">
              <SelectValue placeholder="Legacy module role…" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Overrides the user&apos;s legacy module role template. Platform roles (SI Super Admin, etc.)
        bypass this grid.
      </p>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-center w-16">Create</TableHead>
              <TableHead className="text-center w-16">Read</TableHead>
              <TableHead className="text-center w-16">Update</TableHead>
              <TableHead className="text-center w-16">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SETTINGS_MODULE_KEYS.map((mod) => {
              const perm = rowFor(mod.key);
              return (
                <TableRow key={mod.key}>
                  <TableCell className="text-sm font-medium">{mod.name}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canCreate}
                      disabled={disabled}
                      onCheckedChange={(v) => toggle(mod.key, "canCreate", !!v)}
                      data-testid={`checkbox-perm-${mod.key}-create`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canRead}
                      disabled={disabled}
                      onCheckedChange={(v) => toggle(mod.key, "canRead", !!v)}
                      data-testid={`checkbox-perm-${mod.key}-read`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canUpdate}
                      disabled={disabled}
                      onCheckedChange={(v) => toggle(mod.key, "canUpdate", !!v)}
                      data-testid={`checkbox-perm-${mod.key}-update`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canDelete}
                      disabled={disabled}
                      onCheckedChange={(v) => toggle(mod.key, "canDelete", !!v)}
                      data-testid={`checkbox-perm-${mod.key}-delete`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export { emptyPermissions, fromRoleTemplate };
