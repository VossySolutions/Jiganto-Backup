import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchWithAuth } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, FileText, Loader2, Search } from "lucide-react";

export type LinkedDocument = {
  id: number;
  title: string;
  type?: string;
  status?: string;
};

type DocumentLinkSelectProps = {
  value: string;
  onChange: (documentId: string) => void;
  disabled?: boolean;
  testId?: string;
};

export function DocumentLinkSelect({
  value,
  onChange,
  disabled,
  testId = "document-link-select",
}: DocumentLinkSelectProps) {
  const [search, setSearch] = useState("");

  const { data: documents = [], isLoading } = useQuery<LinkedDocument[]>({
    queryKey: ["/api/documents", "link-picker"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/documents");
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, search]);

  const selected = documents.find((d) => String(d.id) === value);

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0 mt-0.5 text-[#0ea5e9]" />
          <p>
            Link the contract to a document in the Documents module. Required before sending for e-Sign.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="pl-9 h-9"
            disabled={disabled || isLoading}
            data-testid={`${testId}-search`}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading documents…
          </div>
        ) : (
          <Select
            value={value || "none"}
            onValueChange={(v) => onChange(v === "none" ? "" : v)}
            disabled={disabled}
          >
            <SelectTrigger data-testid={`${testId}-trigger`}>
              <SelectValue placeholder="Select a document" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No document linked</SelectItem>
              {filtered.map((doc) => (
                <SelectItem key={doc.id} value={String(doc.id)}>
                  {doc.title}
                  {doc.status ? ` · ${doc.status}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selected && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm">
            <span className="truncate font-medium">{selected.title}</span>
            <Link href={`/modules/documents?doc=${selected.id}`}>
              <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-[#0ea5e9]" data-testid={`${testId}-open`}>
                Open
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Link href="/modules/documents">
        <Button type="button" variant="link" className="h-auto p-0 text-[#0ea5e9]" data-testid={`${testId}-browse`}>
          Browse Documents module
        </Button>
      </Link>
    </div>
  );
}

export function resolveDocumentTitle(documents: LinkedDocument[], documentId: number | null | undefined): string | null {
  if (!documentId) return null;
  return documents.find((d) => d.id === documentId)?.title ?? null;
}
