import { useState } from "react";
import { useParams, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ticket, Mail } from "lucide-react";

const C = { accent: "#0EA5E9", dark: "#0c4a6e" };

export default function HelpDeskPortalPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearch();
  const embed = new URLSearchParams(search).get("embed") === "1";
  const [step, setStep] = useState<"email" | "code" | "portal">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [tab, setTab] = useState("home");
  const [ticketForm, setTicketForm] = useState({ title: "", type: "incident", description: "", contactName: "", priority: "p3" });
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");

  const { data: portal, isLoading } = useQuery({
    queryKey: ["/api/portal", token],
    queryFn: () => fetch(`/api/portal/${token}`).then((r) => (r.ok ? r.json() : null)),
    retry: false,
  });

  const requestCode = useMutation({
    mutationFn: () => fetch(`/api/portal/${token}/request-code`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }).then((r) => r.json()),
    onSuccess: (d) => { if (d.ok) setStep("code"); },
  });

  const verify = useMutation({
    mutationFn: () => fetch(`/api/portal/${token}/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }),
    }).then((r) => r.json()),
    onSuccess: (d) => { if (d.ok) { setSessionToken(d.sessionToken); setStep("portal"); } },
  });

  const { data: myTickets = [], refetch: refetchTickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["portal-tickets", token, sessionToken],
    queryFn: () => fetch(`/api/portal/${token}/tickets`, { headers: { "x-portal-session": sessionToken } }).then((r) => r.json()),
    enabled: !!sessionToken && step === "portal",
  });

  const submitTicket = useMutation({
    mutationFn: () => fetch(`/api/portal/${token}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-session": sessionToken },
      body: JSON.stringify({ ...ticketForm, description: { text: ticketForm.description } }),
    }).then((r) => r.json()),
    onSuccess: () => { refetchTickets(); setTab("tickets"); setTicketForm({ title: "", type: "incident", description: "", contactName: "", priority: "p3" }); },
  });

  const { data: ticketDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["portal-ticket", token, sessionToken, selectedTicketId],
    queryFn: () => fetch(`/api/portal/${token}/tickets/${selectedTicketId}`, { headers: { "x-portal-session": sessionToken } }).then((r) => r.json()),
    enabled: !!sessionToken && selectedTicketId != null,
  });

  const commentMut = useMutation({
    mutationFn: () => fetch(`/api/portal/${token}/tickets/${selectedTicketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-session": sessionToken },
      body: JSON.stringify({ body: { text: commentText } }),
    }).then((r) => r.json()),
    onSuccess: () => { setCommentText(""); setSelectedTicketId(null); refetchTickets(); },
  });

  const branding = (portal?.customBranding ?? {}) as { headerColor?: string; logoUrl?: string };
  const headerColor = branding.headerColor ?? C.accent;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(160deg, ${C.accent}, ${C.dark})` }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/80" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(160deg, ${C.accent}, ${C.dark})` }}>
        <div className="bg-white dark:bg-card rounded-2xl p-8 text-center max-w-md">
          <p className="text-muted-foreground">Portal not found or disabled.</p>
        </div>
      </div>
    );
  }

  if (step !== "portal") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(160deg, ${headerColor}, ${C.dark})` }}>
        <div className="bg-white dark:bg-card rounded-2xl p-8 w-full max-w-md shadow-xl">
          {branding.logoUrl && <img src={branding.logoUrl} alt="" className="h-10 mb-4" />}
          <h1 className="text-xl font-semibold mb-1">{portal.portalName ?? "Support Portal"}</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter your email to access support.</p>
          {step === "email" ? (
            <div className="space-y-4">
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <Button className="w-full" style={{ backgroundColor: headerColor }} onClick={() => requestCode.mutate()} disabled={!email || requestCode.isPending}>
                {requestCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div><Label>Verification Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" /></div>
              <Button className="w-full" style={{ backgroundColor: headerColor }} onClick={() => verify.mutate()} disabled={!code || verify.isPending}>
                {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Sign In"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={embed ? "min-h-screen bg-background" : "min-h-screen bg-background"}>
      {!embed && (
      <header className="text-white px-6 py-5" style={{ backgroundColor: headerColor }}>
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {branding.logoUrl && <img src={branding.logoUrl} alt="" className="h-8" />}
          <div>
            <h1 className="text-lg font-semibold">{portal.portalName ?? "Support Portal"}</h1>
            <p className="text-sm opacity-80 flex items-center gap-1"><Mail className="h-3 w-3" />{email}</p>
          </div>
        </div>
      </header>
      )}

      {embed && (
        <div className="text-white px-4 py-3" style={{ backgroundColor: headerColor }}>
          <h1 className="text-sm font-semibold">{portal.portalName ?? "Support Portal"}</h1>
        </div>
      )}

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 w-full flex flex-wrap h-auto gap-1">
            <TabsTrigger value="home" className="flex-1 sm:flex-none">Home</TabsTrigger>
            <TabsTrigger value="submit" className="flex-1 sm:flex-none">Submit a Ticket</TabsTrigger>
            <TabsTrigger value="tickets" className="flex-1 sm:flex-none">My Tickets</TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <div className="text-center py-12 space-y-4">
              <h2 className="text-2xl font-semibold">Welcome to {portal.portalName ?? "Support"}</h2>
              <p className="text-muted-foreground max-w-md mx-auto">Submit a support request or view your existing tickets.</p>
              <Button size="lg" style={{ backgroundColor: headerColor }} onClick={() => setTab("submit")}>
                <Ticket className="h-4 w-4 mr-2" />Submit a Ticket
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="submit" className="space-y-4 max-w-lg">
            <div><Label>Title</Label><Input value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} /></div>
            <div><Label>Type</Label>
              <Select value={ticketForm.type} onValueChange={(v) => setTicketForm({ ...ticketForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["incident", "service_request", "change_request", "question"].map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} rows={4} /></div>
            <div><Label>Contact Name</Label><Input value={ticketForm.contactName} onChange={(e) => setTicketForm({ ...ticketForm, contactName: e.target.value })} /></div>
            <Button style={{ backgroundColor: headerColor }} onClick={() => submitTicket.mutate()} disabled={!ticketForm.title || submitTicket.isPending}>
              {submitTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Ticket
            </Button>
          </TabsContent>

          <TabsContent value="tickets" className="space-y-3">
            {ticketsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : myTickets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No tickets yet.</p>
            ) : myTickets.map((t: { id: number; ref: string; title: string; status: string; agentName?: string; updatedAt?: string }) => (
              <button key={t.id} type="button" onClick={() => setSelectedTicketId(t.id)} className="w-full text-left p-4 border rounded-xl flex justify-between items-start gap-3 hover:bg-muted/40 transition-colors">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{t.ref}</p>
                  <p className="font-medium">{t.title}</p>
                  {t.agentName && <p className="text-xs text-muted-foreground mt-1">Agent: {t.agentName}</p>}
                  {t.updatedAt && <p className="text-[10px] text-muted-foreground">Updated {new Date(t.updatedAt).toLocaleString()}</p>}
                </div>
                <Badge variant="outline" className="capitalize">{t.status.replace(/_/g, " ")}</Badge>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      {selectedTicketId != null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedTicketId(null)}>
          <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : ticketDetail ? (
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{ticketDetail.ref}</p>
                  <h2 className="font-semibold">{ticketDetail.title}</h2>
                  <Badge variant="outline" className="mt-2 capitalize">{ticketDetail.status?.replace(/_/g, " ")}</Badge>
                  {ticketDetail.agentName && <p className="text-sm text-muted-foreground mt-2">Assigned: {ticketDetail.agentName}</p>}
                </div>
                {(ticketDetail.comments ?? []).map((c: { id: number; body: unknown; createdAt: string }) => (
                  <div key={c.id} className="text-sm p-2 bg-muted rounded-lg">
                    <p>{typeof c.body === "object" && c.body && "text" in (c.body as object) ? (c.body as { text: string }).text : ""}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(c.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                <Textarea placeholder="Add a comment…" value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} />
                <Button style={{ backgroundColor: headerColor }} disabled={!commentText || commentMut.isPending} onClick={() => commentMut.mutate()}>
                  {commentMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Post Comment
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
