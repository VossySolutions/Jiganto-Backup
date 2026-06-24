import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ArrowUpRight, Pencil } from "lucide-react";
import type { CrmLead } from "./types";

export type { CrmLead };

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs font-semibold text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right break-words">{value?.trim() || "—"}</span>
    </div>
  );
}

interface Props {
  lead: CrmLead | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lead: CrmLead) => void;
  onConvert: (lead: CrmLead) => void;
  companyColor: string;
  companyInitials: string;
  ownerName: string;
  statusLabel: React.ReactNode;
  temperatureLabel: React.ReactNode;
}

export function LeadDetailSheet({
  lead,
  open,
  onClose,
  onEdit,
  onConvert,
  companyColor,
  companyInitials,
  ownerName,
  statusLabel,
  temperatureLabel,
}: Props) {
  if (!lead) return null;

  const companyName = lead.company || `${lead.firstName} ${lead.lastName}`;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/40">
          <SheetHeader className="text-left space-y-3">
            <div className="flex items-start gap-3 pr-6">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: companyColor }}
              >
                {companyInitials}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg leading-tight">{companyName}</SheetTitle>
                <SheetDescription className="mt-1">
                  {lead.firstName} {lead.lastName}
                  {lead.title ? ` · ${lead.title}` : ""}
                </SheetDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusLabel}
              {temperatureLabel}
              {lead.rating && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted capitalize">
                  {lead.rating}
                </span>
              )}
            </div>
          </SheetHeader>
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => { onClose(); onEdit(lead); }}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            {lead.status !== "converted" && (
              <Button
                size="sm"
                className="gap-1.5 flex-1 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                onClick={() => { onClose(); onConvert(lead); }}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                Convert
              </Button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Contact</p>
            <div className="rounded-xl border bg-muted/20 px-4">
              <DetailRow label="Email" value={lead.email} />
              <DetailRow label="Phone" value={lead.phone} />
              <DetailRow label="Owner" value={ownerName} />
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Company</p>
            <div className="rounded-xl border bg-muted/20 px-4">
              <DetailRow label="Industry" value={lead.industry} />
              <DetailRow label="Website" value={lead.website} />
              <DetailRow label="Source" value={lead.source} />
            </div>
          </section>

          {lead.description && (
            <section>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-xl border bg-muted/20 p-4">
                {lead.description}
              </p>
            </section>
          )}

          <p className="text-[11px] text-muted-foreground">
            Created {new Date(lead.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
