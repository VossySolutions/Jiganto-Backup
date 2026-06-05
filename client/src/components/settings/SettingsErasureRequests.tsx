import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, fetchWithAuth, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserX } from "lucide-react";

type ErasureRequest = {
  id: string;
  userId: string;
  userEmail?: string;
  status: string;
  requestedAt: string;
};

export default function SettingsErasureRequests() {
  const { toast } = useToast();
  const { data } = useQuery({
    queryKey: ["/api/settings/data-erasure-requests"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/settings/data-erasure-requests");
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ requests: ErasureRequest[] }>;
    },
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/settings/data-erasure-requests/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/data-erasure-requests"] });
      toast({ title: "Erasure approved — user data anonymised" });
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const pending = data?.requests?.filter((r) => r.status === "pending") ?? [];

  return (
    <Card data-testid="settings-erasure-requests">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserX className="h-4 w-4" />
          Right to erasure
        </CardTitle>
        <CardDescription>
          Approve pending requests to anonymise a user&apos;s profile and notifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!pending.length ? (
          <p className="text-sm text-muted-foreground">No pending erasure requests.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{r.userEmail ?? r.userId}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(r.requestedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Pending</Badge>
                  <Button
                    size="sm"
                    onClick={() => approveMut.mutate(r.id)}
                    disabled={approveMut.isPending}
                  >
                    Approve & anonymise
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
