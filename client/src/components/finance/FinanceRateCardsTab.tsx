import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { RATE_CARD_TYPES } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel } from "@/components/ui/form-dialog-shell";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Pencil,
  Download,
  Upload,
  ChevronDown,
  Star,
  CreditCard
} from "lucide-react";
import {
  FinanceTableSkeleton,
  FinanceEmptyState
} from "./FinanceUi";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import {
  MondayBoardProvider,
  MondayBoardTable,
  MondayBoardChromeControls,
} from "@/components/MondayBoardTable";
import { useDebouncedValue } from "@/lib/crm-monday-chrome";
import type { FinanceRateCard, FinanceRateCardItem } from "./types";

const currencySymbol = (c: string) => (c === "USD" ? "$" : c === "EUR" ? "€" : "£");

interface FinanceRateCardsTabProps {
  rateCards?: FinanceRateCard[];
  isLoading?: boolean;
  searchTerm?: string;
}

export function FinanceRateCardsTab({ rateCards: rateCardsProp, isLoading: isLoadingProp, searchTerm = "" }: FinanceRateCardsTabProps) {
  const { toast } = useToast();
  const debouncedSearch = useDebouncedValue(searchTerm);
  const csvRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("standard");
  const [formCurrency, setFormCurrency] = useState("GBP");
  const [formDescription, setFormDescription] = useState("");

  const [newRole, setNewRole] = useState("");
  const [newChargeRate, setNewChargeRate] = useState("");
  const [newCostRate, setNewCostRate] = useState("");

  useEffect(() => {
    setNewRole("");
    setNewChargeRate("");
    setNewCostRate("");
  }, [expandedId]);

  const { data: fetchedRateCards = [], isLoading: fetchLoading } = useQuery<FinanceRateCard[]>({
    queryKey: ["/api/finance/rate-cards"],
    enabled: rateCardsProp === undefined,
  });
  const rateCards = rateCardsProp ?? fetchedRateCards;
  const isLoading = isLoadingProp ?? fetchLoading;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/finance/rate-cards"] });

  const createCardMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/finance/rate-cards", {
      name: formName,
      cardType: formType,
      currency: formCurrency,
      description: formDescription || null,
    }),
    onSuccess: () => { invalidate(); toast({ title: "Rate card created" }); resetForm(); },
    onError: () => toast({ title: "Failed to create rate card", variant: "destructive" }),
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/finance/rate-cards/${id}`, data),
    onSuccess: () => { invalidate(); toast({ title: "Rate card updated" }); resetForm(); },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/finance/rate-cards/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Rate card deleted" }); setExpandedId(null); },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ cardId, roleName, dailyRate, costRate }: { cardId: number; roleName: string; dailyRate: string; costRate: string }) =>
      apiRequest("POST", `/api/finance/rate-cards/${cardId}/items`, { roleName, dailyRate, costRate }),
    onSuccess: () => {
      invalidate();
      setNewRole("");
      setNewChargeRate("");
      setNewCostRate("");
      toast({ title: "Role rate added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => apiRequest("DELETE", `/api/finance/rate-card-items/${itemId}`),
    onSuccess: () => { invalidate(); toast({ title: "Role removed" }); },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormType("standard");
    setFormCurrency("GBP");
    setFormDescription("");
  };

  const startEdit = (card: FinanceRateCard) => {
    setEditingId(card.id);
    setFormName(card.name);
    setFormType(card.cardType ?? "standard");
    setFormCurrency(card.currency ?? "GBP");
    setFormDescription(card.description ?? "");
    setShowForm(true);
  };

  const filtered = useMemo(() => rateCards.filter((c) => {
    if (typeFilter !== "all" && c.cardType !== typeFilter) return false;
    if (debouncedSearch && !c.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  }), [rateCards, typeFilter, debouncedSearch]);

  const mondayColumns: MondayColumnDef<FinanceRateCard>[] = useMemo(() => [
    {
      id: "name",
      header: "Rate card",
      type: "text",
      accessor: "name",
      width: "220px",
      sticky: true,
      editable: false,
      render: (card) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{card.name}</span>
          {card.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      type: "text",
      accessor: "cardType",
      width: "120px",
      editable: false,
      render: (card) => <Badge variant="outline" className="capitalize">{card.cardType}</Badge>,
    },
    {
      id: "currency",
      header: "Currency",
      type: "text",
      accessor: "currency",
      width: "100px",
      editable: false,
      render: (card) => <Badge variant="secondary">{card.currency}</Badge>,
    },
    {
      id: "roles",
      header: "Roles",
      type: "number",
      accessor: (card) => card.items?.length ?? 0,
      width: "80px",
      editable: false,
    },
    {
      id: "description",
      header: "Description",
      type: "text",
      accessor: "description",
      width: "240px",
      editable: false,
      render: (card) => <span className="text-sm text-muted-foreground truncate">{card.description ?? "—"}</span>,
    },
  ], []);

  const expandedCard = expandedId != null ? filtered.find((c) => c.id === expandedId) ?? rateCards.find((c) => c.id === expandedId) : null;

  const allItems = rateCards.flatMap((c) => (c.items ?? []).map((i) => ({ ...i, cardName: c.name })));

  const exportCSV = useCallback(() => {
    if (allItems.length === 0) return;
    const headers = ["Card", "Role", "Charge Rate", "Cost Rate"];
    const rows = allItems.map((i) =>
      [i.cardName, i.roleName, i.dailyRate, i.costRate ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-rate-cards.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${allItems.length} rows` });
  }, [allItems, toast]);

  const importCSV = (file: File) => {
    if (!expandedId) {
      toast({ title: "Expand a rate card first to import into it", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
        const roleName = (cols[1] ?? cols[0] ?? "").trim();
        const charge = (cols[2] ?? cols[1] ?? "").trim();
        const cost = (cols[3] ?? cols[2] ?? "").trim();
        if (roleName && charge) {
          addItemMutation.mutate({ cardId: expandedId, roleName, dailyRate: charge, costRate: cost || "0" });
        }
      }
      toast({ title: "CSV import started" });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4" data-testid="finance-rate-cards-tab">
      <MondayBoardProvider storageKey="jiganto-finance-rate-cards">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Card type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {RATE_CARD_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={allItems.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importCSV(f);
        }} />
        <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Import CSV
        </Button>
        {rateCards.length > 0 && (
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="ml-auto" data-testid="button-create-rate-card">
          <Plus className="h-4 w-4 mr-1" /> New Rate Card
        </Button>
        )}
        <MondayBoardChromeControls />
      </div>

      {isLoading ? (
        <FinanceTableSkeleton rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <FinanceEmptyState
          icon={CreditCard}
          title="No rate cards"
          description={rateCards.length === 0 ? "Define charge and cost rates for roles across projects and clients." : "No rate cards match your search or filters."}
          action={rateCards.length === 0 ? (
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}><Plus className="h-4 w-4 mr-1" /> New Rate Card</Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          <MondayBoardTable
            columns={mondayColumns}
            data={filtered}
            gridLines
            emptyMessage="No rate cards match your search or filters."
            onRowClick={(card) => setExpandedId(expandedId === card.id ? null : card.id)}
            renderRowActions={(card) => (
              <>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40" onClick={(e) => { e.stopPropagation(); startEdit(card); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" onClick={(e) => { e.stopPropagation(); deleteCardMutation.mutate(card.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            alwaysShowRowActions
            searchHighlightTerm={debouncedSearch}
            paginationResetKey={`${debouncedSearch}-${typeFilter}`}
            totalCount={rateCards.length}
            columnWidthStorageKey="jiganto-finance-rate-cards-col-widths"
          />

          {expandedCard && (
            <Card className="rounded-xl border-primary/30" data-testid={`rate-card-${expandedCard.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => setExpandedId(null)} className="shrink-0">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <span className="font-medium">{expandedCard.name}</span>
                  {expandedCard.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  <Badge variant="outline" className="capitalize">{expandedCard.cardType}</Badge>
                  <Badge variant="secondary">{expandedCard.currency}</Badge>
                </div>
                <div className="pl-7 space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Charge rate</TableHead>
                        <TableHead className="text-right">Cost rate</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(expandedCard.items ?? []).map((item: FinanceRateCardItem) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.roleName}</TableCell>
                          <TableCell className="text-right tabular-nums">{currencySymbol(expandedCard.currency || "GBP")}{item.dailyRate}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.costRate != null ? `${currencySymbol(expandedCard.currency || "GBP")}${item.costRate}` : "—"}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => deleteItemMutation.mutate(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap items-end gap-2">
                    <Input placeholder="Role name" value={newRole} onChange={(e) => setNewRole(e.target.value)} className="max-w-[160px]" />
                    <Input placeholder={`Charge ${currencySymbol(expandedCard.currency || "GBP")}/day`} value={newChargeRate} onChange={(e) => setNewChargeRate(e.target.value)} className="max-w-[120px]" />
                    <Input placeholder={`Cost ${currencySymbol(expandedCard.currency || "GBP")}/day`} value={newCostRate} onChange={(e) => setNewCostRate(e.target.value)} className="max-w-[120px]" />
                    <Button
                      size="sm"
                      disabled={!newRole || !newChargeRate}
                      onClick={() => addItemMutation.mutate({
                        cardId: expandedCard.id,
                        roleName: newRole.trim(),
                        dailyRate: newChargeRate,
                        costRate: newCostRate || "0",
                      })}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add role
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </MondayBoardProvider>

      <FormDialogShell
        open={showForm}
        onOpenChange={(open) => !open && resetForm()}
        title={editingId ? "Edit rate card" : "New rate card"}
        subtitle="Define billing rates and currency for projects"
        saveLabel={editingId ? "Save changes" : "Create rate card"}
        onCancel={resetForm}
        onSubmit={() => {
          if (editingId) {
            updateCardMutation.mutate({ id: editingId, data: { name: formName, cardType: formType, currency: formCurrency, description: formDescription } });
          } else {
            createCardMutation.mutate();
          }
        }}
        saving={createCardMutation.isPending || updateCardMutation.isPending}
        disabled={!formName.trim()}
        testId="rate-card-form-dialog"
      >
        <FormSection icon={<CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Rate card details">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Name</FieldLabel>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Standard consulting rates" />
          </div>
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5">
              <FieldLabel>Type</FieldLabel>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RATE_CARD_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Currency</FieldLabel>
              <Select value={formCurrency} onValueChange={setFormCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <div className="space-y-1.5">
            <FieldLabel>Description</FieldLabel>
            <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional notes" />
          </div>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
