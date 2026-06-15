import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PresenceEntry {
  presence: {
    userId: string;
    editingPageId?: number | null;
    editingRowId?: number | null;
  };
  user?: { id: string; firstName?: string | null; lastName?: string | null };
}

export function WorkspacePresenceAvatars({
  workspaceId,
  currentPageId,
  className,
}: {
  workspaceId: number;
  currentPageId?: number | null;
  className?: string;
}) {
  const { data: presence = [] } = useQuery<PresenceEntry[]>({
    queryKey: ["/api/workspaces", workspaceId, "presence"],
    enabled: workspaceId > 0,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/presence`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  if (presence.length === 0) return null;

  return (
    <div className={cn("flex items-center -space-x-2", className)} data-testid="workspace-presence-avatars">
      {presence.slice(0, 5).map((entry, index) => {
        const label =
          [entry.user?.firstName, entry.user?.lastName].filter(Boolean).join(" ") || entry.presence.userId;
        const onSamePage = currentPageId && entry.presence.editingPageId === currentPageId;
        return (
          <Avatar
            key={entry.presence.userId}
            className={cn("h-7 w-7 border-2 border-background", onSamePage && "ring-2 ring-green-500")}
            style={{ zIndex: presence.length - index }}
            title={`${label}${onSamePage ? " · editing this page" : ""}`}
          >
            <AvatarFallback className="text-[10px]">{label.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        );
      })}
      {presence.length > 5 && (
        <span className="ml-3 text-[10px] text-muted-foreground">+{presence.length - 5}</span>
      )}
    </div>
  );
}

/** Poll page for remote updates while editing (lightweight realtime). */
export function useWorkspacePageSync(pageId: number, enabled: boolean, onRemoteUpdate: () => void) {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useQuery({
    queryKey: ["/api/workspace-pages", pageId, "sync"],
    enabled: enabled && pageId > 0,
    refetchInterval: 12000,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspace-pages/${pageId}`);
      if (!res.ok) return null;
      const page = await res.json();
      const updated = page.updatedAt as string | undefined;
      if (lastUpdated && updated && updated !== lastUpdated) {
        onRemoteUpdate();
      }
      if (updated) setLastUpdated(updated);
      return page;
    },
  });
}
