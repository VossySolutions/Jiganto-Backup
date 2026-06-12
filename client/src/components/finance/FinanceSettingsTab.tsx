import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// useMutation used in both main component and ExchangeRatesSection
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings } from "lucide-react";
import { FinanceTabLoading, FinanceButtonSpinner } from "./FinanceUi";
import type { FinanceSettings } from "./types";

interface FinanceSettingsTabProps {
  settings?: FinanceSettings;
  isLoading?: boolean;
}

export function FinanceSettingsTab({ settings: settingsProp, isLoading: isLoadingProp }: FinanceSettingsTabProps) {
  const { toast } = useToast();
  const { data: fetched, isLoading: fetchLoading } = useQuery<FinanceSettings>({
    queryKey: ["/api/finance/settings"],
    enabled: settingsProp === undefined,
  });
  const data = settingsProp ?? fetched;
  const isLoading = isLoadingProp ?? fetchLoading;

  const [form, setForm] = useState<Partial<FinanceSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/finance/settings", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/settings"] });
      toast({ title: "Finance settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div data-testid="finance-settings-loading">
        <FinanceTabLoading label="Loading finance settings..." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="finance-settings-tab">
      <Card className="rounded-xl border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Finance Settings</CardTitle>
          <CardDescription>Currency, timesheet approval (ADR-004), invoicing defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base currency</Label>
              <Select value={form.baseCurrency ?? "GBP"} onValueChange={(v) => setForm({ ...form, baseCurrency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timesheet approval (ADR-004)</Label>
              <Select value={form.timesheetApprovalMode ?? "both"} onValueChange={(v) => setForm({ ...form, timesheetApprovalMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">PM + Resource Manager (default)</SelectItem>
                  <SelectItem value="pm_only">PM only</SelectItem>
                  <SelectItem value="rm_only">Resource Manager only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice prefix</Label>
              <Input value={form.invoicePrefix ?? "INV"} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Default payment terms</Label>
              <Select value={form.defaultPaymentTerms ?? "net_30"} onValueChange={(v) => setForm({ ...form, defaultPaymentTerms: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="net_7">Net 7</SelectItem>
                  <SelectItem value="net_14">Net 14</SelectItem>
                  <SelectItem value="net_30">Net 30</SelectItem>
                  <SelectItem value="net_60">Net 60</SelectItem>
                  <SelectItem value="due_on_receipt">Due on receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organisation address (on invoices)</Label>
            <Textarea value={form.orgAddress ?? ""} onChange={(e) => setForm({ ...form, orgAddress: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Bank details (on invoices)</Label>
            <Textarea value={form.orgBankDetails ?? ""} onChange={(e) => setForm({ ...form, orgBankDetails: e.target.value })} rows={2} />
          </div>
          <div>
            <Label className="mb-2 block">Mileage rates (£/mile)</Label>
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Car" value={form.mileageRateCar ?? "0.45"} onChange={(e) => setForm({ ...form, mileageRateCar: e.target.value })} />
              <Input placeholder="Motorcycle" value={form.mileageRateMotorcycle ?? "0.24"} onChange={(e) => setForm({ ...form, mileageRateMotorcycle: e.target.value })} />
              <Input placeholder="Bicycle" value={form.mileageRateBicycle ?? "0.20"} onChange={(e) => setForm({ ...form, mileageRateBicycle: e.target.value })} />
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <ExchangeRatesSection />
    </div>
  );
}

function ExchangeRatesSection() {
  const { toast } = useToast();
  const { data: rates = [], refetch } = useQuery<Array<{ id: number; fromCurrency: string; toCurrency: string; rate: string; rateDate: string }>>({
    queryKey: ["/api/finance/exchange-rates"],
  });
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("GBP");
  const [rate, setRate] = useState("");
  const [rateDate, setRateDate] = useState(new Date().toISOString().slice(0, 10));

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/finance/exchange-rates", { fromCurrency: from, toCurrency: to, rate, rateDate }),
    onSuccess: () => { refetch(); toast({ title: "Exchange rate added" }); setRate(""); },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exchange Rates</CardTitle>
        <CardDescription>Manual rates per transaction date (multi-currency)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
          <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate" />
          <Input type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => addMutation.mutate()} disabled={!rate || addMutation.isPending}>
          {addMutation.isPending ? <FinanceButtonSpinner /> : "Add rate"}
        </Button>
        {rates.length > 0 && (
          <ul className="text-sm space-y-1">
            {rates.slice(0, 5).map((r) => (
              <li key={r.id}>{r.rateDate}: 1 {r.fromCurrency} = {r.rate} {r.toCurrency}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
