import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";

type ShareTarget = "page" | "row";

export function WorkspacePublicShareDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ShareTarget;
  targetId: number;
  label?: string;
}) {
  const { toast } = useToast();
  const basePath =
    targetType === "page"
      ? `/api/workspace-pages/${targetId}/public-token`
      : `/api/workspace-database-rows/${targetId}/public-token`;
  const publicPath =
    targetType === "page" ? "/public/workspace/pages" : "/public/workspace/rows";

  const { data, isLoading, refetch } = useQuery<{ token: string | null }>({
    queryKey: [basePath],
    enabled: open && targetId > 0,
    queryFn: async () => {
      const res = await fetchWithAuth(basePath);
      if (!res.ok) throw new Error("Failed to load share link");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", basePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [basePath] });
      refetch();
      toast({ title: "Public link created" });
    },
    onError: () => toast({ title: "Failed to create link", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", basePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [basePath] });
      refetch();
      toast({ title: "Public link revoked" });
    },
    onError: () => toast({ title: "Failed to revoke link", variant: "destructive" }),
  });

  const token = data?.token ?? null;
  const publicUrl = token ? `${window.location.origin}${publicPath}/${token}` : "";

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Public link
          </DialogTitle>
          <DialogDescription>
            {label ? `Share "${label}"` : "Anyone with the link can view this item without signing in."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : token ? (
            <>
              <Input value={publicUrl} readOnly data-testid="workspace-public-link-input" />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1" onClick={copyLink} data-testid="workspace-copy-public-link">
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => revokeMutation.mutate()}
                  disabled={revokeMutation.isPending}
                  data-testid="workspace-revoke-public-link"
                >
                  {revokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </>
          ) : (
            <Button
              className="w-full gap-1"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="workspace-generate-public-link"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Generate public link
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
