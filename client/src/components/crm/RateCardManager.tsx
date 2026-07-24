import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  X,
  CreditCard,
  Loader2,
  Star,
  Download,
  Upload
} from "lucide-react";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import {
  MondayBoardProvider,
  MondayBoardTable,
  MondayBoardChromeControls,
} from "@/components/MondayBoardTable";
import { useDebouncedValue } from "@/lib/crm-monday-chrome";

type RateCardItem = {
  id: number;
  rateCardId: number;
  roleName: string;
  dailyRate: string;
};

type RateCard = {
  id: number;
  name: string;
  description: string | null;
  currency: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isDefault: boolean;
  items?: RateCardItem[];
};

interface RateCardManagerProps {
  open: boolean;
  onClose: () => void;
  onSelectRateCard?: (cardId: number) => void;
  selectedRateCardId?: number | null;
  readOnly?: boolean;
}

export function RateCardManager({ open, onClose, onSelectRateCard, selectedRateCardId, readOnly = false }: RateCardManagerProps) {
  const { toast } = useToast();
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState("");
  const debouncedSearch = useDebouncedValue(listSearch);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCurrency, setFormCurrency] = useState("GBP");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState("");
  const [formEffectiveTo, setFormEffectiveTo] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);

  const [newItemRole, setNewItemRole] = useState("");
  const [newItemRate, setNewItemRate] = useState("");

  const { data: rateCards = [], isLoading } = useQuery<RateCard[]>({
    queryKey: ["/api/resources/rate-cards"],
  });

  const { data: skillsList = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/resources/skills"],
  });

  const createCardMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; currency: string; effectiveFrom: string; effectiveTo: string; isDefault: boolean }) => {
      return apiRequest("POST", "/api/resources/rate-cards", {
        ...data,
        effectiveFrom: data.effectiveFrom || null,
        effectiveTo: data.effectiveTo || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/rate-cards"] });
      toast({ title: "Rate card created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create rate card", variant: "destructive" });
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return apiRequest("PUT", `/api/resources/rate-cards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/rate-cards"] });
      toast({ title: "Rate card updated" });
      setEditingCard(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update rate card", variant: "destructive" });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/resources/rate-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/rate-cards"] });
      toast({ title: "Rate card deleted" });
      setExpandedCardId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete rate card", variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ cardId, roleName, dailyRate }: { cardId: number; roleName: string; dailyRate: string }) => {
      return apiRequest("POST", `/api/resources/rate-cards/${cardId}/items`, { roleName, dailyRate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/rate-cards"] });
      setNewItemRole("");
      setNewItemRate("");
      toast({ title: "Role rate added" });
    },
    onError: () => {
      toast({ title: "Failed to add role rate", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("DELETE", `/api/resources/rate-card-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/rate-cards"] });
      toast({ title: "Role rate removed" });
    },
  });

  const resetForm = useCallback(() => {
    setCreateMode(false);
    setEditingCard(null);
    setFormName("");
    setFormDescription("");
    setFormCurrency("GBP");
    setFormEffectiveFrom("");
    setFormEffectiveTo("");
    setFormIsDefault(false);
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    setNewItemRole("");
    setNewItemRate("");
  }, [expandedCardId]);

  const handleSaveCard = () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const data = {
      name: formName.trim(),
      description: formDescription,
      currency: formCurrency,
      effectiveFrom: formEffectiveFrom,
      effectiveTo: formEffectiveTo,
      isDefault: formIsDefault,
    };
    if (editingCard) {
      updateCardMutation.mutate({
        id: editingCard.id,
        data: {
          ...data,
          effectiveFrom: data.effectiveFrom || null,
          effectiveTo: data.effectiveTo || null,
        },
      });
    } else {
      createCardMutation.mutate(data);
    }
  };

  const startEdit = useCallback((card: RateCard) => {
    setEditingCard(card);
    setCreateMode(false);
    setFormName(card.name);
    setFormDescription(card.description || "");
    setFormCurrency(card.currency || "GBP");
    setFormEffectiveFrom(card.effectiveFrom ? card.effectiveFrom.slice(0, 10) : "");
    setFormEffectiveTo(card.effectiveTo ? card.effectiveTo.slice(0, 10) : "");
    setFormIsDefault(card.isDefault || false);
  }, []);

  const startCreate = useCallback(() => {
    resetForm();
    setCreateMode(true);
  }, [resetForm]);

  const handleAddItem = (cardId: number) => {
    if (!newItemRole.trim()) {
      toast({ title: "Role name is required", variant: "destructive" });
      return;
    }
    if (!newItemRate || parseFloat(newItemRate) <= 0) {
      toast({ title: "Valid daily rate is required", variant: "destructive" });
      return;
    }
    addItemMutation.mutate({ cardId, roleName: newItemRole.trim(), dailyRate: newItemRate });
  };

  const handleSelectAndClose = (cardId: number) => {
    onSelectRateCard?.(cardId);
    onClose();
  };

  const csvImportRef = useRef<HTMLInputElement>(null);

  const allItems = rateCards.flatMap(card => (card.items || []).map(item => ({ ...item, cardName: card.name })));

  const exportCSV = useCallback(() => {
    if (allItems.length === 0) return;
    const headers = ["Role Name", "Daily Rate"];
    const csvRows = allItems.map(item =>
      [item.roleName, item.dailyRate].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rate-card-items-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${allItems.length} rate card items to CSV` });
  }, [allItems, toast]);

  const importCSV = useCallback((file: File) => {
    if (!expandedCardId) {
      toast({ title: "Please expand a rate card first to import items into it", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "CSV file is empty", variant: "destructive" });
        return;
      }
      let importedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(c => c.replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
        if (cols.length < 2) continue;
        const roleName = (cols[0] || "").trim();
        const dailyRate = (cols[1] || "").trim();
        if (!roleName || !dailyRate) continue;
        addItemMutation.mutate({ cardId: expandedCardId, roleName, dailyRate });
        importedCount++;
      }
      if (importedCount > 0) {
        toast({ title: `Importing ${importedCount} items from CSV` });
      } else {
        toast({ title: "No valid rows found in CSV", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (csvImportRef.current) csvImportRef.current.value = "";
  }, [expandedCardId, addItemMutation, toast]);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const currencySymbol = (c: string) => c === "USD" ? "$" : c === "EUR" ? "€" : "£";

  const showForm = createMode || editingCard;

  const filteredRateCards = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return rateCards.filter((card) => {
      if (!q) return true;
      return `${card.name} ${card.description ?? ""} ${card.currency}`.toLowerCase().includes(q);
    });
  }, [rateCards, debouncedSearch]);

  const mondayColumns: MondayColumnDef<RateCard>[] = useMemo(() => [
    {
      id: "name",
      header: "Rate card",
      type: "text",
      accessor: "name",
      width: "200px",
      sticky: true,
      editable: false,
      render: (card) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold truncate">{card.name}</span>
          {card.isDefault && (
            <Badge variant="secondary" className="text-[10px] gap-0.5">
              <Star className="h-2.5 w-2.5" /> Default
            </Badge>
          )}
          {selectedRateCardId === card.id && <Badge className="text-[10px] bg-[#0ea5e9]">Active</Badge>}
        </div>
      ),
    },
    {
      id: "currency",
      header: "Currency",
      type: "text",
      accessor: "currency",
      width: "90px",
      editable: false,
    },
    {
      id: "effective",
      header: "Effective",
      type: "text",
      accessor: (card) => `${card.effectiveFrom ?? ""}-${card.effectiveTo ?? ""}`,
      width: "180px",
      editable: false,
      render: (card) => (
        <span className="text-[11px] text-muted-foreground">
          {fmtDate(card.effectiveFrom)} — {fmtDate(card.effectiveTo)}
        </span>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      type: "number",
      accessor: (card) => card.items?.length ?? 0,
      width: "70px",
      editable: false,
    },
    {
      id: "description",
      header: "Description",
      type: "text",
      accessor: "description",
      width: "200px",
      editable: false,
      render: (card) => <span className="text-xs text-muted-foreground truncate">{card.description ?? "—"}</span>,
    },
  ], [selectedRateCardId]);

  const expandedCard = expandedCardId != null ? rateCards.find((c) => c.id === expandedCardId) : null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}
      title={readOnly ? "Rate Cards (Read-Only)" : "Rate Card Management"}
      subtitle={readOnly ? "Select a card to apply rates to this plan." : "Create and manage reusable rate cards."}
      saveLabel={showForm && !readOnly ? (editingCard ? "Update" : "Create") : "Close"}
      onCancel={() => { resetForm(); onClose(); }}
      onSubmit={showForm && !readOnly ? handleSaveCard : () => { resetForm(); onClose(); }}
      testId="rate-card-manager"
      size="xl"
      bodyClassName="max-h-[80vh]"
    >
      <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {showForm && !readOnly ? (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20" data-testid="rate-card-form">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm font-bold">{editingCard ? "Edit Rate Card" : "Create New Rate Card"}</h4>
                <Button type="button" variant="ghost" size="icon" onClick={resetForm} data-testid="button-cancel-form">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Name</Label>
                  <Input
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Standard 2025"
                    data-testid="input-card-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Currency</Label>
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger data-testid="select-card-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                <Input
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Optional description..."
                  data-testid="input-card-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Effective From</Label>
                  <Input
                    type="date"
                    value={formEffectiveFrom}
                    onChange={e => setFormEffectiveFrom(e.target.value)}
                    data-testid="input-card-effective-from"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Effective To</Label>
                  <Input
                    type="date"
                    value={formEffectiveTo}
                    onChange={e => setFormEffectiveTo(e.target.value)}
                    data-testid="input-card-effective-to"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={e => setFormIsDefault(e.target.checked)}
                  className="rounded border-border"
                  id="default-check"
                  data-testid="checkbox-card-default"
                />
                <Label htmlFor="default-check" className="text-xs text-muted-foreground cursor-pointer">
                  Set as default rate card
                </Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#0ea5e9] hover:bg-[#0284c7] gap-1.5"
                  disabled={createCardMutation.isPending || updateCardMutation.isPending}
                  onClick={handleSaveCard}
                  data-testid="button-save-card"
                >
                  {(createCardMutation.isPending || updateCardMutation.isPending) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {editingCard ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {rateCards.length} rate card{rateCards.length !== 1 ? "s" : ""} available
              </p>
              {!readOnly && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    ref={csvImportRef}
                    accept=".csv"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) importCSV(file);
                    }}
                    data-testid="input-import-csv"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => csvImportRef.current?.click()}
                    data-testid="button-import-csv"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={exportCSV}
                    disabled={allItems.length === 0}
                    data-testid="button-export-csv"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 bg-[#0ea5e9] hover:bg-[#0284c7]"
                    onClick={startCreate}
                    data-testid="button-create-card"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Rate Card
                  </Button>
                </div>
              )}
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rateCards.length === 0 && !showForm ? (
                <div className="text-center py-12">
                  <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground mb-3">No rate cards yet</p>
                  {!readOnly && (
                    <Button size="sm" className="gap-1.5 bg-[#0ea5e9] hover:bg-[#0284c7]" onClick={startCreate}>
                      <Plus className="h-3.5 w-3.5" />
                      Create your first rate card
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <MondayBoardProvider storageKey="jiganto-resources-rate-cards">
                  <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Search rate cards…"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="h-8 text-sm max-w-xs"
                    data-testid="rate-card-search"
                  />
                  <MondayBoardChromeControls />
                  </div>
                  <MondayBoardTable
                    columns={mondayColumns}
                    data={filteredRateCards}
                    gridLines
                    emptyMessage="No rate cards match your search."
                    onRowClick={(card) => setExpandedCardId(expandedCardId === card.id ? null : card.id)}
                    searchHighlightTerm={debouncedSearch}
                    paginationResetKey={debouncedSearch}
                    className="border-border/60"
                    renderRowActions={(card) => (
                      <div className="flex items-center gap-1">
                        {onSelectRateCard && (
                          <Button
                            variant={selectedRateCardId === card.id ? "default" : "outline"}
                            size="sm"
                            className={cn("text-xs h-7", selectedRateCardId === card.id && "bg-[#0ea5e9] hover:bg-[#0284c7]")}
                            onClick={(e) => { e.stopPropagation(); handleSelectAndClose(card.id); }}
                          >
                            {selectedRateCardId === card.id ? "Selected" : "Select"}
                          </Button>
                        )}
                        {!readOnly && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setExpandedCardId(card.id); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteCardMutation.mutate(card.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    alwaysShowRowActions
                  />
                  {expandedCard && (
                    <Card className="overflow-visible border-primary/30" data-testid={`rate-card-manager-${expandedCard.id}`}>
                      <div className="p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-muted-foreground uppercase">Role Rates — {expandedCard.name}</span>
                          {!readOnly && (
                            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => startEdit(expandedCard)}>
                              <Pencil className="h-3 w-3" /> Edit Card Details
                            </Button>
                          )}
                        </div>
                        {(expandedCard.items && expandedCard.items.length > 0) ? (
                          <div className="space-y-1">
                            {expandedCard.items.map(item => {
                              const sym = currencySymbol(expandedCard.currency || "GBP");
                              return (
                                <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 rounded-md" data-testid={`rate-item-${item.id}`}>
                                  <span className="text-sm font-medium">{item.roleName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono font-bold">{sym}{Number(item.dailyRate).toLocaleString("en-GB")}/day</span>
                                    {!readOnly && (
                                      <Button variant="ghost" size="icon" onClick={() => deleteItemMutation.mutate(item.id)} disabled={deleteItemMutation.isPending}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground py-2">No role rates defined yet.</p>
                        )}
                        {!readOnly && (
                          <div className="flex items-end gap-2 p-3 border border-dashed rounded-lg bg-muted/20" data-testid="add-item-form">
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px] uppercase text-muted-foreground">Role / Skill</Label>
                              <Input value={newItemRole} onChange={e => setNewItemRole(e.target.value)} placeholder="e.g. Solution Architect" className="text-sm" list={`skills-list-${expandedCard.id}`} data-testid="input-item-role" />
                              <datalist id={`skills-list-${expandedCard.id}`}>
                                {skillsList.map(s => <option key={s.id} value={s.name} />)}
                              </datalist>
                            </div>
                            <div className="w-32 space-y-1">
                              <Label className="text-[10px] uppercase text-muted-foreground">Daily Rate ({currencySymbol(expandedCard.currency || "GBP")})</Label>
                              <Input type="number" value={newItemRate} onChange={e => setNewItemRate(e.target.value)} placeholder="900" className="text-sm" data-testid="input-item-rate" />
                            </div>
                            <Button size="sm" className="bg-[#0ea5e9] hover:bg-[#0284c7] gap-1" onClick={() => handleAddItem(expandedCard.id)} disabled={addItemMutation.isPending} data-testid="button-add-item">
                              {addItemMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                  </div>
                  </MondayBoardProvider>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
    </FormDialogShell>
  );
}
