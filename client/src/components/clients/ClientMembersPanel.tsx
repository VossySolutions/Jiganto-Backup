import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Mail } from "lucide-react";
import { ClientsSheetLoading } from "./ClientLoadingStates";
import type { ClientMember, ClientWorkspace } from "./types";

interface Props {
  client: ClientWorkspace | null;
  open: boolean;
  onClose: () => void;
  siMembers: { userId: string; label: string }[];
}

export function ClientMembersPanel({ client, open, onClose, siMembers }: Props) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [addSiUserId, setAddSiUserId] = useState("");

  const { data: members = [], isLoading } = useQuery<ClientMember[]>({
    queryKey: ["/api/clients", client?.id, "users"],
    enabled: !!client && open,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${client!.id}/users`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const addSiMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/clients/${client!.id}/users`, {
        userId: addSiUserId,
        role: "editor",
        memberType: "si",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client?.id, "users"] });
      setAddSiUserId("");
      toast({ title: "SI team member added" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const inviteMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/clients/${client!.id}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
        memberType: "client",
      }),
    onSuccess: () => {
      setInviteEmail("");
      toast({ title: "Invitation sent" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("DELETE", `/api/clients/${client!.id}/users/${userId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client?.id, "users"] });
      toast({ title: "Member removed" });
    },
  });

  const siTeam = members.filter((m) => m.memberType === "si");
  const clientUsers = members.filter((m) => m.memberType !== "si");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle>Manage members</SheetTitle>
          <SheetDescription>{client?.name} — workspace access</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6">
            <ClientsSheetLoading />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">SI team members</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={addSiUserId || "__none__"} onValueChange={(v) => setAddSiUserId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add consultant" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select user</SelectItem>
                    {siMembers.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gap-2 shrink-0"
                  disabled={!addSiUserId || addSiMut.isPending}
                  onClick={() => addSiMut.mutate()}
                >
                  <UserPlus className="h-4 w-4" />
                  {addSiMut.isPending ? "Adding…" : "Add"}
                </Button>
              </div>
              <div className="space-y-2">
                {siTeam.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    removing={removeMut.isPending}
                    onRemove={() => removeMut.mutate(m.userId)}
                  />
                ))}
                {siTeam.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No SI members yet.</p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Client users</h4>
              <div className="space-y-2">
                <Label>Invite by email</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder="client@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workspace_admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="gap-2 w-full sm:w-auto"
                  disabled={!inviteEmail.trim() || inviteMut.isPending}
                  onClick={() => inviteMut.mutate()}
                >
                  <Mail className="h-4 w-4" />
                  {inviteMut.isPending ? "Sending…" : "Send invite"}
                </Button>
              </div>
              <div className="space-y-2">
                {clientUsers.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    removing={removeMut.isPending}
                    onRemove={() => removeMut.mutate(m.userId)}
                  />
                ))}
                {clientUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No client users yet.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MemberRow({
  member,
  onRemove,
  removing,
}: {
  member: ClientMember;
  onRemove: () => void;
  removing?: boolean;
}) {
  const name = member.userInfo
    ? `${member.userInfo.firstName ?? ""} ${member.userInfo.lastName ?? ""}`.trim() || member.userInfo.email
    : member.userId;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{member.userInfo?.email}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className="text-[10px] capitalize hidden sm:inline-flex">{member.role.replace("_", " ")}</Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} disabled={removing}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
