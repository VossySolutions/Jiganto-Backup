import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, History } from "lucide-react";

type Props = { entryId: number };

export function BpmlVersionHistory({ entryId }: Props) {
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/bpml/entries/${entryId}/history`],
    enabled: !!entryId,
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!history.length) return <p className="text-xs text-muted-foreground py-2">No change history yet.</p>;

  return (
    <div data-testid="bpml-version-history">
      <p className="text-xs font-medium flex items-center gap-1 mb-2"><History className="h-3 w-3" /> Version History</p>
      <ScrollArea className="h-40">
        <div className="space-y-2 pr-2">
          {history.map((h: any) => (
            <div key={h.id} className="text-xs border rounded-md p-2" data-testid={`history-entry-${h.id}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <Badge variant="outline" className="text-[9px]">{h.fieldName}</Badge>
                <span className="text-muted-foreground">{new Date(h.changedAt).toLocaleString()}</span>
              </div>
              <p className="text-muted-foreground line-through truncate">{h.oldValue || "(empty)"}</p>
              <p className="truncate">{h.newValue || "(empty)"}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
