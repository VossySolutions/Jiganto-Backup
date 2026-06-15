import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ServiceDeskCardGridSkeleton,
  ServiceDeskTabLoading,
  ServiceDeskErrorState,
  ServiceDeskEmptyState,
  SD_ACCENT,
} from "./ServiceDeskUi";
import { ChevronDown, ChevronRight, Clock, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ServiceCategory, ServiceItem, FormField } from "./types";
import { PRIORITY_LABELS } from "./types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ServiceDeskCatalogueAdmin } from "./ServiceDeskCatalogueAdmin";

interface CatalogueData {
  categories: ServiceCategory[];
  services: ServiceItem[];
}

export function ServiceDeskCatalogueTab() {
  const { toast } = useToast();
  const [requestService, setRequestService] = useState<ServiceItem | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("p3");
  const [openCats, setOpenCats] = useState<Set<number>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery<CatalogueData>({
    queryKey: ["/api/service-desk/catalogue"],
  });

  const { data: adminData } = useQuery<CatalogueData>({
    queryKey: ["/api/service-desk/catalogue?admin=1"],
  });

  const requestMut = useMutation({
    mutationFn: async (serviceId: number) => {
      const res = await apiRequest("POST", `/api/service-desk/services/${serviceId}/request`, {
        title: title || requestService?.name,
        description: description ? { text: description } : undefined,
        priority,
        customFields: formValues,
      });
      return res.json();
    },
    onSuccess: (ticket) => {
      toast({ title: "Request submitted", description: `Ticket ${ticket.ref} created.` });
      setRequestService(null);
      queryClient.invalidateQueries({ queryKey: ["/api/service-desk/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-desk/dashboard"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="sd-catalogue-loading">
        <ServiceDeskCardGridSkeleton count={6} />
      </div>
    );
  }

  if (isError) {
    return <ServiceDeskErrorState message="Could not load service catalogue." onRetry={() => refetch()} />;
  }

  if (!data || (data.services.length === 0 && data.categories.length === 0)) {
    return (
      <ServiceDeskEmptyState
        icon={BookOpen}
        title="No services in catalogue"
        description="Run npm run db:seed-service-desk to load demo services, or add categories via the API."
      />
    );
  }

  const byCategory = data.categories.map((cat) => ({
    ...cat,
    services: data.services.filter((s) => s.categoryId === cat.id),
  }));
  const uncategorised = data.services.filter((s) => !s.categoryId);

  const openRequest = (svc: ServiceItem) => {
    setRequestService(svc);
    setTitle(svc.name);
    setDescription("");
    setFormValues({});
    setPriority("p3");
  };

  const slaSummary = (svc: ServiceItem) => {
    const p3 = svc.slas.find((s) => s.priority === "p3");
    if (p3) return `Response: ${p3.responseHours}h · Resolution: ${p3.resolutionHours}h`;
    const first = svc.slas[0];
    return first ? `Response: ${first.responseHours}h · Resolution: ${first.resolutionHours}h` : "SLA per priority";
  };

  const renderServiceCard = (svc: ServiceItem) => (
    <Card key={svc.id} className="rounded-xl border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{svc.name}</CardTitle>
        <CardDescription className="line-clamp-2">{svc.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{slaSummary(svc)}</Badge>
          {svc.teamName && <Badge variant="secondary">{svc.teamName}</Badge>}
          <Badge variant="outline">{svc.availability.replace("_", " ")}</Badge>
        </div>
        <Button size="sm" className="w-full rounded-xl" style={{ backgroundColor: SD_ACCENT }} onClick={() => openRequest(svc)}>
          Request this service
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <ServiceDeskCatalogueAdmin
        categories={adminData?.categories ?? data.categories}
        services={adminData?.services ?? data.services}
      />
      {byCategory.map((cat) => (
        <Collapsible
          key={cat.id}
          open={openCats.has(cat.id)}
          onOpenChange={(o) => {
            const next = new Set(openCats);
            if (o) next.add(cat.id); else next.delete(cat.id);
            setOpenCats(next);
          }}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-3 rounded-xl bg-muted/40 hover:bg-muted/60">
            {openCats.has(cat.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-semibold">{cat.name}</span>
            <Badge variant="secondary" className="ml-auto">{cat.services.length}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.services.map(renderServiceCard)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {uncategorised.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Other Services</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uncategorised.map(renderServiceCard)}
          </div>
        </div>
      )}

      <Dialog open={!!requestService} onOpenChange={() => setRequestService(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request: {requestService?.name}</DialogTitle>
            <DialogDescription>Submit a service request. SLA clock starts on submission.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(requestService?.requestFormFields as FormField[] ?? []).map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}{f.required ? " *" : ""}</Label>
                {f.type === "select" ? (
                  <Select value={formValues[f.key] ?? ""} onValueChange={(v) => setFormValues({ ...formValues, [f.key]: v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={formValues[f.key] ?? ""}
                    onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
            <Button
              className="w-full rounded-xl"
              disabled={requestMut.isPending}
              onClick={() => requestService && requestMut.mutate(requestService.id)}
            >
              {requestMut.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
