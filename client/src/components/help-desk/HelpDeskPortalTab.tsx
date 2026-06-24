import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { Globe, Copy, Mail, Loader2, ExternalLink, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  HelpDeskTabLoading,
  HelpDeskErrorState,
  HelpDeskEmptyState,
  HelpDeskTableWrap,
  HelpDeskRefreshing,
  HelpDeskCardGridSkeleton,
  HelpDeskTableSkeleton,
  HD_ACCENT,
} from "./HelpDeskUi";

interface PortalConfig {
  id: number;
  clientId: number | null;
  token: string;
  allowedEmailDomains: string[];
  allowedEmails: string[];
  isActive: boolean;
  portalName: string | null;
  customBranding: { headerColor?: string; logoUrl?: string; subdomain?: string };
}

interface ActivityRow {
  id: number;
  email: string;
  action: string;
  createdAt: string;
  ipAddress: string | null;
}

interface ClientRow { id: number; name: string }

export function HelpDeskPortalTab() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [domains, setDomains] = useState("");
  const [emails, setEmails] = useState("");
  const [portalName, setPortalName] = useState("Support Portal");
  const [clientId, setClientId] = useState("");
  const [headerColor, setHeaderColor] = useState("#0EA5E9");
  const [logoUrl, setLogoUrl] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [inviteOpen, setInviteOpen] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

  const { data: configs = [], isLoading, isError, isFetching, refetch } = useQuery<PortalConfig[]>({
    queryKey: ["/api/help-desk/portal/configs"],
    staleTime: 60_000,
  });

  const { data: clients = [] } = useQuery<ClientRow[]>({
    queryKey: ["/api/clients"],
    staleTime: 60_000,
  });

  const { data: activity = [], isLoading: activityLoading, isFetching: activityFetching } = useQuery<ActivityRow[]>({
    queryKey: [`/api/help-desk/portal/configs/${selectedId}/activity`],
    enabled: selectedId != null,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/help-desk/portal/configs", {
        portalName,
        clientId: clientId ? Number(clientId) : null,
        allowedEmailDomains: domains.split(",").map((s) => s.trim()).filter(Boolean),
        allowedEmails: emails.split(",").map((s) => s.trim()).filter(Boolean),
        isActive: true,
        customBranding: { headerColor, logoUrl: logoUrl || undefined, subdomain: subdomain || undefined },
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Portal created" });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/portal/configs"] });
      setDomains("");
      setEmails("");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/help-desk/portal/configs/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/help-desk/portal/configs"] }),
  });

  const inviteMut = useMutation({
    mutationFn: async ({ id, email, message }: { id: number; email: string; message?: string }) => {
      const res = await apiRequest("POST", `/api/help-desk/portal/configs/${id}/send-invite`, { email, message });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Portal access email sent" });
      setInviteOpen(null);
      setInviteEmail("");
      setInviteMessage("");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const portalUrl = (token: string) => `${window.location.origin}/portal/${token}`;
  const embedCode = (token: string) => `<iframe src="${portalUrl(token)}?embed=1" width="100%" height="720" frameborder="0" title="Support Portal"></iframe>`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <HelpDeskCardGridSkeleton count={1} />
        <HelpDeskTabLoading label="Loading portal settings…" />
      </div>
    );
  }
  if (isError) {
    return <HelpDeskErrorState message="Could not load portal configs. Run npm run db:push." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="hd-portal-tab">
      <HelpDeskRefreshing show={isFetching} />

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Globe className="h-4 w-4" style={{ color: HD_ACCENT }} />
            Client Portal Setup
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Token + magic-link auth, per-client branding, CNAME subdomain, and iframe embed for enterprise clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Portal Name</Label>
              <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} className="h-9 sm:h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Client</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 sm:h-10"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client (global)</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Header Color</Label>
              <Input type="color" value={headerColor} onChange={(e) => setHeaderColor(e.target.value)} className="h-9 sm:h-10 p-1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Logo URL</Label>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className="h-9 sm:h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Custom Subdomain (CNAME)</Label>
              <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="help.client.com" className="h-9 sm:h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Allowed Email Domains</Label>
              <Input placeholder="acme.com, partner.co.uk" value={domains} onChange={(e) => setDomains(e.target.value)} className="h-9 sm:h-10" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs sm:text-sm">Allowed Emails (optional)</Label>
              <Input placeholder="user@client.com" value={emails} onChange={(e) => setEmails(e.target.value)} className="h-9 sm:h-10" />
            </div>
          </div>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="w-full sm:w-auto" style={{ backgroundColor: HD_ACCENT }}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enable Portal
          </Button>
        </CardContent>
      </Card>

      {configs.length === 0 ? (
        <HelpDeskEmptyState icon={Globe} title="No portals configured" description="Create a portal above to give clients secure access to submit support tickets." />
      ) : configs.map((c) => {
        const branding = c.customBranding ?? {};
        return (
          <Card key={c.id} className="rounded-2xl border-border/50 overflow-hidden">
            <div className="h-0.5 w-full" style={{ backgroundColor: branding.headerColor ?? HD_ACCENT }} />
            <CardHeader className="px-4 sm:px-6 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm sm:text-base">{c.portalName ?? "Support Portal"}</CardTitle>
                  <CardDescription className="font-mono text-[10px] sm:text-xs mt-1 break-all">{portalUrl(c.token)}</CardDescription>
                  {branding.subdomain && (
                    <p className="text-[10px] text-muted-foreground mt-1">CNAME: {branding.subdomain} → {window.location.host}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Switch checked={c.isActive ?? true} onCheckedChange={(v) => toggleMut.mutate({ id: c.id, isActive: v })} disabled={toggleMut.isPending} />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { navigator.clipboard.writeText(portalUrl(c.token)); toast({ title: "URL copied" }); }}>
                    <Copy className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">URL</span>
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { navigator.clipboard.writeText(embedCode(c.token)); toast({ title: "Embed code copied" }); }}>
                    <Code className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Embed</span>
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setInviteOpen(c.id)}>
                    <Mail className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Invite</span>
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" asChild>
                    <a href={portalUrl(c.token)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Open</span>
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
                    Activity
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0 space-y-3">
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline">Domains: {(c.allowedEmailDomains ?? []).join(", ") || "Any"}</Badge>
                {c.clientId && <Badge variant="secondary">Client #{c.clientId}</Badge>}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {selectedId != null && (
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-sm sm:text-base">Portal Activity Log</CardTitle>
            <HelpDeskRefreshing show={activityFetching && !activityLoading} />
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {activityLoading ? <HelpDeskTableSkeleton rows={4} cols={4} /> : activity.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No activity yet.</p>
            ) : (
              <HelpDeskTableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden sm:table-cell">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{a.email}</TableCell>
                        <TableCell className="text-xs capitalize">{a.action.replace(/_/g, " ")}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{a.ipAddress ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </HelpDeskTableWrap>
            )}
          </CardContent>
        </Card>
      )}

      <FormDialogShell
        open={inviteOpen != null}
        onOpenChange={(o) => !o && setInviteOpen(null)}
        title="Send Portal Access"
        saveLabel="Send Invite"
        onCancel={() => setInviteOpen(null)}
        onSubmit={() => inviteOpen && inviteMut.mutate({ id: inviteOpen, email: inviteEmail, message: inviteMessage })}
        saving={inviteMut.isPending}
        disabled={!inviteEmail}
        size="sm"
      >
        <FormSection title="Invite details">
          <div className="space-y-1.5 mb-3.5"><FieldLabel required>Email</FieldLabel><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><FieldLabel>Message (optional)</FieldLabel><Input value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} /></div>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
