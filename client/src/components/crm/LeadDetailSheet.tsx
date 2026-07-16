import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ArrowUpRight, Pencil, X } from "lucide-react";
import type { CrmLead } from "./types";
import { LeadExtrasPanel } from "./LeadExtrasPanel";
import { cn } from "@/lib/utils";

export type { CrmLead };

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2.5 border-b border-[#e6e9ef] last:border-0 items-start">
      <span className="text-[13px] text-[#676879] shrink-0 pt-0.5">{label}</span>
      <span className="text-[14px] font-medium text-[#323338] break-words min-h-[20px]">
        {value?.trim() || "—"}
      </span>
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
  initialExtrasTab?: "comments" | "files" | "subtasks";
}

/** monday.com-style item side panel (column fields + updates). */
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
  initialExtrasTab = "comments",
}: Props) {
  if (!lead) return null;

  const companyName = lead.company || `${lead.firstName} ${lead.lastName}`;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        className={cn(
          "w-full sm:max-w-md overflow-y-auto p-0 border-l border-[#d0d4e4]",
          "[&>button]:hidden",
        )}
      >
        <div className="px-5 pt-4 pb-4 border-b border-[#d0d4e4] bg-white sticky top-0 z-10">
          <SheetHeader className="text-left space-y-3">
            <div className="flex items-start gap-3">
              <div
                className="h-10 w-10 rounded-[4px] flex items-center justify-center text-white font-semibold text-sm shrink-0"
                style={{ backgroundColor: companyColor }}
              >
                {companyInitials}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-[18px] font-medium leading-tight text-[#323338]">
                  {companyName}
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-[13px] text-[#676879]">
                  {lead.firstName} {lead.lastName}
                  {lead.title ? ` · ${lead.title}` : ""}
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-[4px] flex items-center justify-center text-[#676879] hover:bg-[#dcdfec]/60 shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusLabel}
              {temperatureLabel}
              {lead.rating && (
                <span className="text-[12px] font-medium min-h-[22px] px-2 rounded-[4px] bg-[#f5f6f8] text-[#323338] capitalize inline-flex items-center">
                  {lead.rating}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(lead)}
                data-testid="button-edit-lead-sheet"
                className="h-8 border-[#c5c7d0] text-[#323338] hover:bg-[#dcdfec]/60"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
              {lead.status !== "converted" && (
                <Button
                  size="sm"
                  className="h-8 bg-[#0073ea] hover:bg-[#0060b9] text-white shadow-none"
                  onClick={() => onConvert(lead)}
                >
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  Convert
                </Button>
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="px-5 py-3">
          <p className="text-[12px] font-medium text-[#676879] uppercase tracking-wide mb-1">Columns</p>
          <DetailRow label="Email" value={lead.email} />
          <DetailRow label="Phone" value={lead.phone} />
          <DetailRow label="Company" value={lead.company} />
          <DetailRow label="Title" value={lead.title} />
          <DetailRow label="Source" value={lead.source} />
          <DetailRow label="Owner" value={ownerName} />
          <DetailRow label="Industry" value={lead.industry} />
          <DetailRow label="Website" value={lead.website} />
          <DetailRow label="Description" value={lead.description} />
        </div>

        <LeadExtrasPanel lead={lead} initialTab={initialExtrasTab} />
      </SheetContent>
    </Sheet>
  );
}
