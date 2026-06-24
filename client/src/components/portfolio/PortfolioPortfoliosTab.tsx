import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBudget } from "./rag-utils";

type PortfolioRow = {
  id: number;
  name: string;
  description: string | null;
  colour: string | null;
  status: string | null;
  ragStatus: string | null;
  budget: string | null;
  projectCount: number;
};

export function PortfolioPortfoliosTab({ searchTerm = "" }: { searchTerm?: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PortfolioRow | null>(null);
  const [form, setForm] = useState({ name: "", description: "", colour: "#7C3AED" });
  const [linkPortfolio, setLinkPortfolio] = useState<PortfolioRow | null>(null);
  const [linkedIds, setLinkedIds] = useState<number[]>([]);

  const { data: linkData } = useQuery<{
    projects: { id: number; name: string; clientName: string | null }[];
    linkedProjectIds: number[];
  }>({
    queryKey: linkPortfolio ? [`/api/portfolio/portfolios/${linkPortfolio.id}/projects`] : ["disabled"],
    enabled: !!linkPortfolio,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (linkData) setLinkedIds(linkData.linkedProjectIds);
  }, [linkData]);

  const { data: portfolios = [], isLoading } = useQuery<PortfolioRow[]>({
    queryKey: ["/api/portfolio/portfolios"],
    staleTime: 30_000,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        return apiRequest("PUT", `/api/portfolio/portfolios/${editing.id}`, form);
      }
      return apiRequest("POST", "/api/portfolio/portfolios", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/dashboard"] });
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", description: "", colour: "#7C3AED" });
      toast({ title: editing ? "Portfolio updated" : "Portfolio created" });
    },
    onError: () => toast({ title: "Failed to save portfolio", variant: "destructive" }),
  });

  const linkMut = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/portfolio/portfolios/${linkPortfolio!.id}/projects`, { projectIds: linkedIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/dashboard"] });
      setLinkPortfolio(null);
      toast({ title: "Project links updated" });
    },
    onError: () => toast({ title: "Failed to update links", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/portfolio/portfolios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/portfolios"] });
      toast({ title: "Portfolio deleted" });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", colour: "#7C3AED" });
    setShowForm(true);
  };

  const openEdit = (p: PortfolioRow) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || "", colour: p.colour || "#7C3AED" });
    setShowForm(true);
  };

  const q = searchTerm.trim().toLowerCase();
  const visiblePortfolios = useMemo(
    () => (q ? portfolios.filter((pf) => pf.name.toLowerCase().includes(q) || (pf.description ?? "").toLowerCase().includes(q)) : portfolios),
    [portfolios, q],
  );

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <p className="text-sm text-muted-foreground">Manage portfolios — group programmes and projects for strategic oversight.</p>
        <Button size="sm" className="w-full sm:w-auto" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Portfolio</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visiblePortfolios.map((pf) => (
          <Card key={pf.id} className="border-border/30 border-t-4" style={{ borderTopColor: pf.colour || "#7C3AED" }}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm">{pf.name}</CardTitle>
                <div className="flex flex-wrap gap-1 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLinkPortfolio(pf)}>Link</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pf)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(pf.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>{pf.description || "No description"}</p>
              <p>{pf.projectCount} linked projects · RAG {pf.ragStatus}</p>
              <p>Budget {formatBudget(parseFloat(pf.budget || "0"))}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <FormDialogShell
        open={!!linkPortfolio}
        onOpenChange={(o) => !o && setLinkPortfolio(null)}
        onCancel={() => setLinkPortfolio(null)}
        onSubmit={() => linkMut.mutate()}
        title={`Link projects — ${linkPortfolio?.name ?? ""}`}
        saveLabel={linkMut.isPending ? "Saving..." : "Save links"}
        saving={linkMut.isPending}
        size="md"
      >
        <FormSection title="Project links" icon={<span className="h-2 w-2 rounded-full bg-blue-500" />}>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {linkData?.projects.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkedIds.includes(p.id)}
                  onChange={(e) => {
                    setLinkedIds((ids) => e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id));
                  }}
                />
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.clientName || "Internal"}</span>
              </label>
            ))}
          </div>
        </FormSection>
      </FormDialogShell>

      <FormDialogShell
        open={showForm}
        onOpenChange={setShowForm}
        onCancel={() => setShowForm(false)}
        onSubmit={() => saveMut.mutate()}
        title={editing ? "Edit Portfolio" : "Create Portfolio"}
        saveLabel={saveMut.isPending ? "Saving..." : "Save"}
        saving={saveMut.isPending}
        disabled={!form.name}
      >
        <FormSection title="Portfolio details" icon={<span className="h-2 w-2 rounded-full bg-violet-500" />}>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Name</FieldLabel>
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Description</FieldLabel>
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Colour</FieldLabel>
            <input type="color" value={form.colour} onChange={(e) => setForm((f) => ({ ...f, colour: e.target.value }))} />
          </div>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
