import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useCrmUsers } from "./CrmUsersProvider";
import type { CrmNoteRecord } from "./types";

type ForecastOpportunityNotesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: number | null;
  opportunityName: string;
};

function parseNoteText(content: string): string {
  return content
    .replace(/\[TAG:[^\]]+\]/g, "")
    .replace(/\[SENTIMENT:[^\]]+\]/g, "")
    .trim();
}

function formatNoteDate(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ForecastOpportunityNotesDialog({
  open,
  onOpenChange,
  opportunityId,
  opportunityName,
}: ForecastOpportunityNotesDialogProps) {
  const { resolveOwner } = useCrmUsers();

  const { data: notes = [], isLoading } = useQuery<CrmNoteRecord[]>({
    queryKey: opportunityId
      ? [`/api/crm/notes?entityType=opportunity&entityId=${opportunityId}`]
      : ["/api/crm/notes?disabled=forecast"],
    enabled: open && opportunityId != null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(80vh,560px)] flex flex-col" data-testid="forecast-notes-dialog">
        <DialogHeader>
          <DialogTitle>Opportunity notes</DialogTitle>
          <DialogDescription>{opportunityName}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-[120px] -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No notes for this opportunity yet.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const authorName = note.createdByUserId
                  ? resolveOwner(note.createdByUserId).name
                  : "Unknown user";
                return (
                  <div
                    key={note.id}
                    className="rounded-lg border border-border/60 bg-muted/20 p-3"
                    data-testid={`forecast-note-${note.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold">{authorName}</span>
                      <span className="text-[10px] text-muted-foreground">{formatNoteDate(note.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {parseNoteText(note.content)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
