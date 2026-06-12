import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/TablePagination";
import { useTablePagination } from "@/hooks/use-table-pagination";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
};

export default function SettingsApiKeysSection() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["/api/settings/api-keys"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/settings/api-keys");
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ keys: ApiKeyRow[] }>;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/api-keys", {
        name: name.trim() || "API key",
        scopes: ["read"],
      });
      return res.json() as Promise<{ rawKey: string; key: ApiKeyRow }>;
    },
    onSuccess: (body) => {
      setRevealedKey(body.rawKey);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-keys"] });
      toast({ title: "API key created — copy it now" });
    },
    onError: () => toast({ title: "Failed to create key", variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/settings/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-keys"] });
      toast({ title: "API key revoked" });
    },
  });

  const keys = data?.keys ?? [];
  const keysPagination = useTablePagination(keys, {
    resetKey: keys.length,
  });

  return (
    <Card data-testid="settings-api-keys">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          REST API keys
        </CardTitle>
        <CardDescription>
          Generate scoped keys for external integrations. The full secret is shown once at creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {revealedKey && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium mb-1">Copy your new key</p>
            <code className="break-all text-xs">{revealedKey}</code>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                void navigator.clipboard.writeText(revealedKey);
                toast({ title: "Copied" });
              }}
            >
              Copy to clipboard
            </Button>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>Key name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ERP sync"
              data-testid="input-api-key-name"
            />
          </div>
          <Button
            className="self-end"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            data-testid="button-create-api-key"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-sm">
                  No API keys yet
                </TableCell>
              </TableRow>
            ) : (
              keysPagination.paginatedItems.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                  <TableCell className="text-xs">{k.scopes.join(", ")}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeMut.mutate(k.id)}
                      data-testid={`revoke-api-key-${k.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={keysPagination.page}
          totalPages={keysPagination.totalPages}
          total={keysPagination.total}
          startIndex={keysPagination.startIndex}
          endIndex={keysPagination.endIndex}
          pageSize={keysPagination.pageSize}
          onPageChange={keysPagination.setPage}
          onPageSizeChange={keysPagination.setPageSize}
        />
      </CardContent>
    </Card>
  );
}
