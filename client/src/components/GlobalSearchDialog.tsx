import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, FolderKanban, CheckSquare, MessageSquare, Search } from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import { useClientContext } from "@/hooks/use-client-context";
import { cn } from "@/lib/utils";

type SearchHit = {
  type: "document" | "project" | "task" | "chat";
  id: number;
  title: string;
  subtitle?: string;
  href: string;
};

const TYPE_META: Record<
  SearchHit["type"],
  { label: string; icon: typeof FileText }
> = {
  document: { label: "Documents", icon: FileText },
  project: { label: "Projects", icon: FolderKanban },
  task: { label: "Tasks", icon: CheckSquare },
  chat: { label: "Chat", icon: MessageSquare },
};

const SEARCH_EVENT = "jiganto:global-search";

export function GlobalSearchDialog() {
  const [, navigate] = useLocation();
  const { activeClient } = useClientContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ clientId?: number | null }>).detail;
      if (detail?.clientId != null && activeClient?.id != null && detail.clientId !== activeClient.id) {
        return;
      }
      setOpen(true);
      setQuery("");
    };
    window.addEventListener(SEARCH_EVENT, onOpen);
    return () => window.removeEventListener(SEARCH_EVENT, onOpen);
  }, [activeClient?.id]);

  const { data: results = [], isFetching } = useQuery<SearchHit[]>({
    queryKey: ["/api/search", query, activeClient?.id ?? "master"],
    enabled: open && query.trim().length >= 2,
    staleTime: 15_000,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const goTo = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      navigate(hit.href);
    },
    [navigate],
  );

  const grouped = (["document", "project", "task", "chat"] as const).map((type) => ({
    type,
    hits: results.filter((r) => r.type === type),
  })).filter((g) => g.hits.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 text-left space-y-1">
          <DialogTitle className="text-base">
            {activeClient ? `Search ${activeClient.name}` : "Search everything"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {activeClient
              ? "Results are scoped to this client workspace."
              : "Search across documents, projects, tasks, and chat."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="pl-9"
              data-testid="global-search-input"
            />
          </div>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto border-t">
          {query.trim().length < 2 ? (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">
              Enter at least 2 characters
            </p>
          ) : isFetching ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : grouped.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            grouped.map(({ type, hits }) => {
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              return (
                <div key={type} className="py-2">
                  <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </p>
                  {hits.map((hit) => (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      type="button"
                      onClick={() => goTo(hit)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-2.5 text-left",
                        "hover:bg-muted/60 transition-colors",
                      )}
                      data-testid={`search-hit-${hit.type}-${hit.id}`}
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{hit.title}</p>
                        {hit.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{hit.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
