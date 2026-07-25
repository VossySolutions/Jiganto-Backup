import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogViewShell } from "@/components/ui/form-dialog-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  parseClipboardTable,
  mapPasteRowsToLeadImport,
  customFieldTypeFromInferred,
  type PasteColumnPlan,
  type InferredFieldType,
} from "@/lib/crm-lead-paste";

type CrmLeadPasteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TYPE_OPTIONS: { value: InferredFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone" },
  { value: "dropdown", label: "Dropdown" },
];

export function CrmLeadPasteDialog({ open, onOpenChange }: CrmLeadPasteDialogProps) {
  const [raw, setRaw] = useState("");
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [columns, setColumns] = useState<PasteColumnPlan[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const { toast } = useToast();

  const parsed = useMemo(() => (raw.trim() ? parseClipboardTable(raw) : null), [raw]);

  const reset = () => {
    setStep("paste");
    setColumns([]);
    setRaw("");
  };

  const handleAnalyze = () => {
    const table = parseClipboardTable(raw);
    if (!table) {
      toast({
        title: "Could not parse paste",
        description: "Copy a header row plus data from Excel or Google Sheets, then paste here.",
        variant: "destructive",
      });
      return;
    }
    setColumns(table.columns);
    setRowCount(table.rows.length);
    setStep("review");
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const table = parseClipboardTable(raw);
      if (!table) throw new Error("parse failed");

      const res = await apiRequest("GET", "/api/crm/custom-fields?entityType=lead");
      const existingList = (await res.json()) as { fieldName: string }[];
      const existingNames = new Set((existingList || []).map((f) => f.fieldName));

      let position = existingList.length;
      for (const col of columns) {
        if (col.builtin) continue;
        if (existingNames.has(col.fieldKey)) continue;
        if (position >= 20) break;
        await apiRequest("POST", "/api/crm/custom-fields", {
          entityType: "lead",
          fieldName: col.fieldKey,
          fieldLabel: col.header,
          fieldType: customFieldTypeFromInferred(col.inferredType),
          options: col.inferredType === "dropdown" ? col.sampleValues : undefined,
          position,
          isRequired: false,
        });
        position += 1;
        existingNames.add(col.fieldKey);
      }

      const rows = mapPasteRowsToLeadImport(table, columns);
      const importRes = await apiRequest("POST", "/api/crm/leads/bulk-import", { rows, mode: "append" });
      return importRes.json();
    },
    onSuccess: (result: { imported?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/custom-fields?entityType=lead"] });
      toast({ title: `Imported ${result?.imported ?? rowCount} lead(s) from spreadsheet` });
      reset();
      onOpenChange(false);
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const updateCol = (idx: number, patch: Partial<PasteColumnPlan>) => {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  return (
    <FormDialogViewShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Paste from Excel / Sheets"
      subtitle="Smartsheet-style: paste a header + rows; we infer field types"
      onClose={() => {
        reset();
        onOpenChange(false);
      }}
      size="lg"
      testId="dialog-paste-leads"
      footer={
        step === "paste" ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button className="bg-[#0073ea] hover:bg-[#0060b9] text-white" onClick={handleAnalyze} data-testid="button-analyze-paste">
              Detect columns
            </Button>
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep("paste")}>Back</Button>
            <Button
              className="bg-[#0073ea] hover:bg-[#0060b9] text-white"
              disabled={importMutation.isPending}
              onClick={() => importMutation.mutate()}
              data-testid="button-confirm-paste-import"
            >
              {importMutation.isPending ? "Importing…" : `Import ${rowCount} rows`}
            </Button>
          </div>
        )
      }
    >
      {step === "paste" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Clipboard</Label>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"Company\tFirst Name\tEmail\tStatus\nAcme\tJane\tjane@acme.com\tNew"}
              className="min-h-[180px] font-mono text-xs"
              data-testid="input-paste-spreadsheet"
            />
          </div>
          {parsed && (
            <p className="text-xs text-[#0073ea]">
              Detected {parsed.columns.length} columns × {parsed.rows.length} rows
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#676879] dark:text-muted-foreground">
            Review inferred attribute settings. Unmapped columns become custom fields on Leads.
          </p>
          <div className="rounded-md border border-[#d0d4e4] dark:border-border max-h-[320px] overflow-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f5f6f8] dark:bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-[#676879] dark:text-muted-foreground">Header</th>
                  <th className="text-left px-2 py-1.5 font-medium text-[#676879] dark:text-muted-foreground">Maps to</th>
                  <th className="text-left px-2 py-1.5 font-medium text-[#676879] dark:text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, idx) => (
                  <tr key={`${col.header}-${idx}`} className="border-t border-[#d0d4e4]/80 dark:border-border/80">
                    <td className="px-2 py-1.5 text-[#323338] dark:text-foreground">{col.header}</td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={col.builtin || "__custom__"}
                        onValueChange={(v) =>
                          updateCol(idx, {
                            builtin: v === "__custom__" ? undefined : (v as PasteColumnPlan["builtin"]),
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__custom__">New custom field</SelectItem>
                          <SelectItem value="firstName">First name</SelectItem>
                          <SelectItem value="lastName">Last name</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                          <SelectItem value="title">Title</SelectItem>
                          <SelectItem value="source">Source</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="rating">Rating</SelectItem>
                          <SelectItem value="industry">Industry</SelectItem>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="description">Description</SelectItem>
                          <SelectItem value="score">Score</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={col.inferredType}
                        onValueChange={(v) => updateCol(idx, { inferredType: v as InferredFieldType })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FormDialogViewShell>
  );
}
