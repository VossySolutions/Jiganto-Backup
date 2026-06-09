import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ClientsSheetLoading } from "./ClientLoadingStates";
import type { ClientWorkspace } from "./types";

type ModRow = { key: string; label: string; locked: boolean; isVisible: boolean };

interface Props {
  client: ClientWorkspace | null;
  open: boolean;
  onClose: () => void;
}

export function ClientModuleVisibilityPanel({ client, open, onClose }: Props) {
  const { toast } = useToast();

  const { data: modules = [], isLoading } = useQuery<ModRow[]>({
    queryKey: ["/api/clients", client?.id, "module-visibility"],
    enabled: !!client && open,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${client!.id}/module-visibility`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const saveMut = useMutation({
    mutationFn: (next: ModRow[]) =>
      apiRequest("PUT", `/api/clients/${client!.id}/module-visibility`, {
        modules: next.map((m) => ({ key: m.key, isVisible: m.isVisible })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client?.id, "module-visibility"] });
      toast({ title: "Module visibility updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggle = (key: string) => {
    const next = modules.map((m) =>
      m.key === key ? { ...m, isVisible: !m.isVisible } : m,
    );
    queryClient.setQueryData(["/api/clients", client?.id, "module-visibility"], next);
    saveMut.mutate(next);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle>Module visibility</SheetTitle>
          <SheetDescription>
            Configure which modules {client?.name} users can see. Changes apply immediately.
          </SheetDescription>
        </SheetHeader>

        {saveMut.isPending && (
          <p className="mt-4 text-xs text-muted-foreground">Saving changes…</p>
        )}

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <ClientsSheetLoading />
          ) : (
            <>
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
                Business, CRM, Finance, and Clients are always hidden in this workspace.
              </p>
              {modules.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Label className="truncate">{m.label}</Label>
                    {m.locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                  <Switch
                    checked={m.isVisible}
                    onCheckedChange={() => toggle(m.key)}
                    disabled={m.locked || saveMut.isPending}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
