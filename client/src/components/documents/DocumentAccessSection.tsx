import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Globe, Loader2, Plus, Trash2, Users } from "lucide-react";
import type { DocumentAccessEntry, DocumentAccessSummary } from "@shared/schema";

const PERMISSION_OPTIONS = [
  { value: "read", label: "View", description: "Can view the document" },
  { value: "write", label: "Edit", description: "Can view and edit" },
  { value: "share", label: "Share", description: "Can view, edit, and share" },
  { value: "admin", label: "Admin", description: "Full control except ownership" },
] as const;

const PERMISSION_BADGE: Record<string, string> = {
  owner: "bg-violet-100 text-violet-800 border-violet-200",
  admin: "bg-red-100 text-red-800 border-red-200",
  share: "bg-blue-100 text-blue-800 border-blue-200",
  write: "bg-amber-100 text-amber-800 border-amber-200",
  read: "bg-slate-100 text-slate-700 border-slate-200",
};

const PERMISSION_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  share: "Share",
  write: "Edit",
  read: "View",
};

const SOURCE_LABEL: Record<string, string> = {
  owner: "Owner",
  document: "Direct",
  folder: "Inherited",
  public: "Public",
};

type OrgUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function userLabel(u: OrgUser): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email || u.id;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || "?").toUpperCase();
}

export function DocumentAccessSection({
  documentId,
  ownerId,
  orgUsers,
}: {
  documentId: number;
  ownerId?: string | null;
  orgUsers: OrgUser[];
}) {
  const { toast } = useToast();
  const [addUserId, setAddUserId] = useState("");
  const [addPermission, setAddPermission] = useState<(typeof PERMISSION_OPTIONS)[number]["value"]>("read");
  const [userSearch, setUserSearch] = useState("");

  const { data: access, isLoading } = useQuery<DocumentAccessSummary>({
    queryKey: ["/api/documents", documentId, "access"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/documents/${documentId}/access`);
      if (!res.ok) throw new Error("Failed to load document access");
      return res.json();
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/documents", documentId, "access"] });
    queryClient.invalidateQueries({ queryKey: ["/api/documents/shared-with-me"] });
  };

  const addMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/documents/${documentId}/acl`, {
        subjectType: "user",
        subjectId: addUserId,
        permission: addPermission,
      }),
    onSuccess: () => {
      invalidate();
      setAddUserId("");
      setAddPermission("read");
      setUserSearch("");
      toast({ title: "Access granted", description: "User can now access this document." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to grant access", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ aclId, permission }: { aclId: number; permission: string }) =>
      apiRequest("PUT", `/api/documents/acl/${aclId}`, { permission }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Permission updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update permission", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (aclId: number) => apiRequest("DELETE", `/api/documents/acl/${aclId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Access removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove access", description: err.message, variant: "destructive" });
    },
  });

  const existingUserIds = useMemo(
    () =>
      new Set(
        (access?.entries ?? [])
          .filter((e) => e.subjectType === "user" && e.source === "document")
          .map((e) => e.subjectId),
      ),
    [access?.entries],
  );

  const addableUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return orgUsers
      .filter((u) => u.id !== ownerId && !existingUserIds.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const label = userLabel(u).toLowerCase();
        return label.includes(q) || (u.email ?? "").toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [orgUsers, ownerId, existingUserIds, userSearch]);

  const peopleCount = useMemo(
    () => (access?.entries ?? []).filter((e) => e.subjectType === "user").length,
    [access?.entries],
  );

  return (
    <div className="space-y-6 w-full min-w-0 max-w-none" data-testid="document-access-section">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">User access for this document</h3>
        <p className="text-sm text-muted-foreground">
          {peopleCount} {peopleCount === 1 ? "person has" : "people have"} access
          {access?.publicLinkEnabled ? " · public link enabled" : ""}.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading access…
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs h-9">User</TableHead>
                  <TableHead className="text-xs h-9 w-[100px]">Permission</TableHead>
                  <TableHead className="text-xs h-9 w-[120px] hidden sm:table-cell">Source</TableHead>
                  <TableHead className="text-xs h-9 w-[72px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(access?.entries ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground py-8 text-center">
                      No users have been granted access yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (access?.entries ?? []).map((entry) => (
                    <AccessRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(permission) => {
                        if (!entry.aclId) return;
                        updateMutation.mutate({ aclId: entry.aclId, permission });
                      }}
                      onRemove={() => {
                        if (!entry.aclId) return;
                        removeMutation.mutate(entry.aclId);
                      }}
                      updating={updateMutation.isPending}
                      removing={removeMutation.isPending}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grant access</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="access-user-search" className="text-xs">User</Label>
                <Input
                  id="access-user-search"
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setAddUserId("");
                  }}
                  className="h-9"
                  data-testid="input-access-user-search"
                />
                {userSearch.trim() && addableUsers.length > 0 && (
                  <div className="rounded-md border bg-background max-h-36 overflow-y-auto">
                    {addableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors",
                          addUserId === u.id && "bg-muted",
                        )}
                        onClick={() => {
                          setAddUserId(u.id);
                          setUserSearch(userLabel(u));
                        }}
                        data-testid={`access-user-option-${u.id}`}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">{initials(userLabel(u))}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{userLabel(u)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Permission</Label>
                <Select value={addPermission} onValueChange={(v) => setAddPermission(v as typeof addPermission)}>
                  <SelectTrigger className="h-9" data-testid="select-access-permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMISSION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="h-9 gap-1.5"
                disabled={!addUserId || addMutation.isPending}
                onClick={() => addMutation.mutate()}
                data-testid="button-grant-access"
              >
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Users with folder-level access may also see this document via inheritance (shown as Inherited).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function AccessRow({
  entry,
  onUpdate,
  onRemove,
  updating,
  removing,
}: {
  entry: DocumentAccessEntry;
  onUpdate: (permission: string) => void;
  onRemove: () => void;
  updating: boolean;
  removing: boolean;
}) {
  const isPublic = entry.subjectType === "public";

  return (
    <TableRow data-testid={`access-row-${entry.id}`}>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          {isPublic ? (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">{initials(entry.displayName)}</AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{entry.displayName}</p>
            {entry.email && (
              <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {entry.editable && entry.source === "document" && entry.aclId ? (
          <Select
            value={entry.permission}
            onValueChange={onUpdate}
            disabled={updating}
          >
            <SelectTrigger className="h-8 text-xs w-[96px]" data-testid={`access-permission-${entry.aclId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERMISSION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge
            variant="outline"
            className={cn("text-[10px] font-semibold uppercase", PERMISSION_BADGE[entry.permission] ?? PERMISSION_BADGE.read)}
          >
            {PERMISSION_LABEL[entry.permission] ?? entry.permission}
          </Badge>
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{SOURCE_LABEL[entry.source] ?? entry.source}</span>
          {entry.sourceLabel && entry.source !== "owner" && (
            <span className="block truncate max-w-[140px]" title={entry.sourceLabel}>{entry.sourceLabel}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {entry.editable && entry.source === "document" && entry.aclId ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={removing}
            onClick={onRemove}
            data-testid={`access-remove-${entry.aclId}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/** Compact header chip: avatar stack + count; click opens Members tab. */
export function DocumentAccessHeaderChip({
  documentId,
  onOpenMembers,
}: {
  documentId: number;
  onOpenMembers: () => void;
}) {
  const { data: access } = useQuery<DocumentAccessSummary>({
    queryKey: ["/api/documents", documentId, "access"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/documents/${documentId}/access`);
      if (!res.ok) throw new Error("Failed to load document access");
      return res.json();
    },
  });

  const people = (access?.entries ?? []).filter((e) => e.subjectType === "user");
  if (!people.length) return null;

  const preview = people.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpenMembers}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      title="View who has access"
      data-testid="document-access-header-chip"
    >
      <span className="flex -space-x-1.5">
        {preview.map((p) => (
          <Avatar key={p.id} className="h-5 w-5 border-2 border-background">
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
              {initials(p.displayName)}
            </AvatarFallback>
          </Avatar>
        ))}
      </span>
      <Users className="h-3.5 w-3.5" />
      <span>{people.length}</span>
    </button>
  );
}
