import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, fetchWithAuth, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/TablePagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { Sparkles, Download, Plus, Trash2 } from "lucide-react";

type UsageRow = {
  id: number;
  module: string;
  featureName: string;
  tokensConsumed: number;
  createdAt: string | null;
  userLabel: string;
};

type AiUsageResponse = {
  balance: { balance: number; monthlyAllocation: number } | null;
  usage: UsageRow[];
  tableMissing?: boolean;
};

interface Props {
  tenantId: number;
}

type AiLimit = {
  id: number;
  orgId: number;
  module: string | null;
  userId: string | null;
  monthlyLimit: number;
};

export default function SettingsAiUsageTab({ tenantId }: Props) {
  const { toast } = useToast();
  const [globalLimit, setGlobalLimit] = useState("100000");
  const [limitModule, setLimitModule] = useState("");
  const [limitUserId, setLimitUserId] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/settings/ai-usage", tenantId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/settings/ai-usage?tenantId=${tenantId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AiUsageResponse>;
    },
    enabled: tenantId > 0,
  });

  const { data: limitsData } = useQuery({
    queryKey: ["/api/settings/ai-limits", tenantId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/settings/ai-limits?tenantId=${tenantId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ limits: AiLimit[] }>;
    },
    enabled: tenantId > 0 && !isLoading && !isError,
  });

  const addLimitMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/ai-limits", {
        monthlyLimit: Number(globalLimit),
        module: limitModule.trim() || null,
        userId: limitUserId.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-limits", tenantId] });
      toast({ title: "Limit added" });
    },
    onError: () => toast({ title: "Failed to add limit", variant: "destructive" }),
  });

  const deleteLimitMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/ai-limits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-limits", tenantId] });
    },
  });

  const downloadCsv = async () => {
    const res = await fetchWithAuth(`/api/settings/ai-usage/export?tenantId=${tenantId}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-usage-${tenantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const usageRows = data?.usage ?? [];
  const limitRows = limitsData?.limits ?? [];
  const usagePagination = useTablePagination(usageRows, {
    resetKey: `${tenantId}-${usageRows.length}`,
    enabled: !isLoading && !isError && !data?.tableMissing,
  });
  const limitsPagination = useTablePagination(limitRows, {
    resetKey: `${tenantId}-${limitRows.length}`,
    enabled: !isLoading && !isError && !data?.tableMissing,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading AI usage…</p>;
  }

  if (isError || data?.tableMissing) {
    return (
      <Card data-testid="settings-ai-usage-tab">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI usage
          </CardTitle>
          <CardDescription>
            Run <code className="text-xs">scripts/sql/ai-token-tables.sql</code> in Supabase to
            enable usage tracking.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const balance = data?.balance;

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings-ai-usage-tab">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI token balance
          </CardTitle>
          <CardDescription>Organisation allocation and consumption (last 30 days below)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-center">
          <div>
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-2xl font-semibold" data-testid="ai-balance-remaining">
              {(balance?.balance ?? 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monthly allocation</p>
            <p className="text-lg">
              {(balance?.monthlyAllocation ?? 0).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Usage history</CardTitle>
            <CardDescription>AI calls in the last 30 days</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadCsv} data-testid="button-export-ai-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {usageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usagePagination.paginatedItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge variant="outline">{row.module}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.featureName}</TableCell>
                      <TableCell className="text-sm">{row.userLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.tokensConsumed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={usagePagination.page}
                totalPages={usagePagination.totalPages}
                total={usagePagination.total}
                startIndex={usagePagination.startIndex}
                endIndex={usagePagination.endIndex}
                pageSize={usagePagination.pageSize}
                onPageChange={usagePagination.setPage}
                onPageSizeChange={usagePagination.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Token limits</CardTitle>
          <CardDescription>
            Monthly token caps by organisation, module, or user. Enforced before AI chat requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap items-end">
            <div className="space-y-2">
              <Label>Monthly limit</Label>
              <Input
                type="number"
                value={globalLimit}
                onChange={(e) => setGlobalLimit(e.target.value)}
                className="w-40"
                data-testid="input-ai-global-limit"
              />
            </div>
            <div className="space-y-2">
              <Label>Module (optional)</Label>
              <Input
                value={limitModule}
                onChange={(e) => setLimitModule(e.target.value)}
                placeholder="chat"
                className="w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>User ID (optional)</Label>
              <Input
                value={limitUserId}
                onChange={(e) => setLimitUserId(e.target.value)}
                placeholder="uuid"
                className="w-48"
              />
            </div>
            <Button onClick={() => addLimitMut.mutate()} disabled={addLimitMut.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add limit
            </Button>
          </div>
          {limitRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom limits configured.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Monthly limit</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limitsPagination.paginatedItems.map((lim) => (
                    <TableRow key={lim.id}>
                      <TableCell className="text-sm">
                        {lim.userId
                          ? `User ${lim.userId.slice(0, 8)}…`
                          : lim.module
                            ? `Module: ${lim.module}`
                            : "Organisation (global)"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {lim.monthlyLimit.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLimitMut.mutate(lim.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={limitsPagination.page}
                totalPages={limitsPagination.totalPages}
                total={limitsPagination.total}
                startIndex={limitsPagination.startIndex}
                endIndex={limitsPagination.endIndex}
                pageSize={limitsPagination.pageSize}
                onPageChange={limitsPagination.setPage}
                onPageSizeChange={limitsPagination.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
