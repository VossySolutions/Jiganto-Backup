import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, RefreshCw, Link2, CheckCircle2, XCircle, Settings2,
} from "lucide-react";
import { FinanceTabLoading, FinanceButtonSpinner } from "./FinanceUi";
import type { ErpIntegrationRow, ErpSyncLogRow } from "./types";

const ERP_SYSTEMS = [
  { id: "xero", label: "Xero", description: "Cloud accounting for SMBs" },
  { id: "quickbooks", label: "QuickBooks", description: "Intuit accounting platform" },
  { id: "netsuite", label: "NetSuite", description: "Enterprise ERP suite" },
  { id: "generic", label: "Generic Webhook", description: "Custom REST endpoint" },
] as const;

const DEFAULT_FIELD_MAPPING: Record<string, string> = {
  invoiceNumber: "invoice_number",
  issueDate: "issue_date",
  dueDate: "due_date",
  total: "total_amount",
  clientName: "customer_name",
  currency: "currency_code",
};

function syncStatusBadge(status: string) {
  if (status === "success") return <Badge className="bg-emerald-500 hover:bg-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
  if (status === "failed") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

interface FinanceIntegrationsTabProps {
  integrations?: ErpIntegrationRow[];
  isLoading?: boolean;
}

export function FinanceIntegrationsTab({ integrations: integrationsProp, isLoading: isLoadingProp }: FinanceIntegrationsTabProps) {
  const { toast } = useToast();
  const [showConnect, setShowConnect] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<string>("xero");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [mappingOpen, setMappingOpen] = useState<number | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(DEFAULT_FIELD_MAPPING);

  const { data: fetchedIntegrations = [], isLoading: fetchLoading } = useQuery<ErpIntegrationRow[]>({
    queryKey: ["/api/finance/erp/integrations"],
    enabled: integrationsProp === undefined,
  });
  const integrations = integrationsProp ?? fetchedIntegrations;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: syncLog = [], isLoading: logLoading } = useQuery<ErpSyncLogRow[]>({
    queryKey: ["/api/finance/erp/sync-log"],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/erp/integrations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/erp/sync-log"] });
  };

  const connectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/finance/erp/integrations", {
      system: selectedSystem,
      webhookUrl: selectedSystem === "generic" ? webhookUrl : null,
      autoSync,
      fieldMappingJson: fieldMapping,
      isActive: true,
    }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Integration connected" });
      setShowConnect(false);
    },
    onError: () => toast({ title: "Failed to connect integration", variant: "destructive" }),
  });

  const updateMappingMutation = useMutation({
    mutationFn: ({ id, mapping }: { id: number; mapping: Record<string, string> }) =>
      apiRequest("PUT", `/api/finance/erp/integrations/${id}`, { fieldMappingJson: mapping }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Field mapping saved" });
      setMappingOpen(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PUT", `/api/finance/erp/integrations/${id}`, { isActive }),
    onSuccess: () => { invalidate(); toast({ title: "Integration updated" }); },
  });

  const syncMutation = useMutation({
    mutationFn: (body: { entityType: "invoice" | "expense"; entityId: number }) =>
      apiRequest("POST", "/api/finance/erp/sync", body),
    onSuccess: () => {
      invalidate();
      toast({ title: "Manual sync completed" });
    },
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  const connectedSystems = new Set(integrations.map((i) => i.system));

  return (
    <div className="space-y-6" data-testid="finance-integrations-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">ERP Integrations</h3>
          <p className="text-sm text-muted-foreground">Connect accounting systems and sync invoices & expenses</p>
        </div>
        <Button onClick={() => setShowConnect(true)} className="w-full sm:w-auto" data-testid="button-connect-integration">
          <Plus className="h-4 w-4 mr-1" />
          Connect
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <FinanceTabLoading label="Loading integrations..." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="rounded-xl border-border/50 h-40 animate-pulse bg-muted/30" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ERP_SYSTEMS.map((sys) => {
            const connected = integrations.find((i) => i.system === sys.id);
            return (
              <Card key={sys.id} className="rounded-xl border-border/50" data-testid={`erp-card-${sys.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-emerald-500" />
                        {sys.label}
                      </CardTitle>
                      <CardDescription>{sys.description}</CardDescription>
                    </div>
                    {connected ? (
                      <Badge className={connected.isActive ? "bg-emerald-500 hover:bg-emerald-500" : "bg-muted text-muted-foreground"}>
                        {connected.isActive ? "Connected" : "Inactive"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not connected</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Auto sync</span>
                        <Switch
                          checked={connected.autoSync ?? false}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: connected.id, isActive: v })}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setMappingOpen(connected.id);
                          setFieldMapping(connected.fieldMappingJson ?? DEFAULT_FIELD_MAPPING);
                        }}>
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          Field mapping
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const failed = syncLog.find((l) => l.status === "failed" && l.integrationId === connected.id);
                            if (failed) {
                              syncMutation.mutate({
                                entityType: failed.entityType as "invoice" | "expense",
                                entityId: failed.entityId,
                              });
                            } else {
                              toast({ title: "No failed syncs to retry for this integration" });
                            }
                          }}
                          disabled={syncMutation.isPending}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                          Sync now
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedSystem(sys.id); setShowConnect(true); }}
                      disabled={connectedSystems.has(sys.id)}
                    >
                      Connect {sys.label}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="rounded-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Sync Log</CardTitle>
          <CardDescription>Recent outbound sync attempts</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Synced at</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLog.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sync activity yet</TableCell>
                    </TableRow>
                  ) : syncLog.map((log) => (
                    <TableRow key={log.id} data-testid={`sync-log-${log.id}`}>
                      <TableCell>{log.entityType} #{log.entityId}</TableCell>
                      <TableCell className="capitalize">{log.direction}</TableCell>
                      <TableCell>{syncStatusBadge(log.status)}</TableCell>
                      <TableCell>{new Date(log.syncedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-destructive max-w-[200px] truncate">{log.errorMessage ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConnect} onOpenChange={setShowConnect}>
        <DialogContent data-testid="connect-integration-dialog">
          <DialogHeader>
            <DialogTitle>Connect ERP Integration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>System</Label>
              <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ERP_SYSTEMS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSystem === "generic" && (
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}
            {selectedSystem === "netsuite" && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Enter NetSuite credentials after connecting. REST API token auth is stored securely per organisation.</p>
                <Input placeholder="Account ID" />
                <Input placeholder="Consumer Key" />
                <Input placeholder="Token ID" type="password" />
              </div>
            )}
            {(selectedSystem === "xero" || selectedSystem === "quickbooks") && (
              <p className="text-sm text-muted-foreground">
                OAuth connection requires {selectedSystem === "xero" ? "XERO_CLIENT_ID" : "QUICKBOOKS_CLIENT_ID"} in server environment. Click Connect to store integration profile; complete OAuth when keys are configured.
              </p>
            )}
            <div className="flex items-center justify-between">
              <Label>Enable auto sync</Label>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnect(false)}>Cancel</Button>
            <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <FinanceButtonSpinner /> : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mappingOpen != null} onOpenChange={(open) => !open && setMappingOpen(null)}>
        <DialogContent className="max-w-md" data-testid="field-mapping-dialog">
          <DialogHeader>
            <DialogTitle>Field Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto">
            {Object.entries(fieldMapping).map(([jigantoField, erpField]) => (
              <div key={jigantoField} className="grid grid-cols-2 gap-2 items-center">
                <Label className="text-xs text-muted-foreground capitalize">{jigantoField.replace(/([A-Z])/g, " $1")}</Label>
                <Input
                  value={erpField}
                  onChange={(e) => setFieldMapping({ ...fieldMapping, [jigantoField]: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingOpen(null)}>Cancel</Button>
            <Button
              onClick={() => mappingOpen && updateMappingMutation.mutate({ id: mappingOpen, mapping: fieldMapping })}
              disabled={updateMappingMutation.isPending}
            >
              {updateMappingMutation.isPending ? <FinanceButtonSpinner /> : "Save mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
