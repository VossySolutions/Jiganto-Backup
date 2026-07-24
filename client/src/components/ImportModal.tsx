import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Upload, FileText, AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportMode = "append" | "replace";

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  templateHeaders: string[];
  exampleRow: Record<string, string>;
  onImport: (rows: Record<string, string>[], mode: ImportMode) => Promise<void>;
  currentCount?: number;
}

function parseCSV(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n");
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseRow(line);
    if (values.every(v => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").replace(/^"|"$/g, ""); });
    rows.push(row);
  }
  return rows;
}

function downloadTemplate(entityName: string, headers: string[], exampleRow: Record<string, string>) {
  const escape = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n")) ? `"${v.replace(/"/g, '""')}"` : v;
  const headerLine = headers.join(",");
  const exampleLine = headers.map(h => escape(exampleRow[h] ?? "")).join(",");
  const csv = `${headerLine}\n${exampleLine}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entityName.toLowerCase().replace(/\s+/g, "-")}-template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImportModal({ isOpen, onClose, entityName, templateHeaders, exampleRow, onImport, currentCount }: ImportModalProps) {
  const [mode, setMode] = useState<ImportMode>("append");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setMode("append");
    setReplaceConfirmed(false);
    setParsedRows(null);
    setFileName(null);
    setParseError(null);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setParseError("Please select a CSV file (.csv)");
      return;
    }
    setFileName(file.name);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setParseError("No data rows found. Make sure the file has a header row and at least one data row.");
          setParsedRows(null);
        } else {
          setParsedRows(rows);
        }
      } catch {
        setParseError("Could not parse the file. Please check it is a valid CSV.");
        setParsedRows(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(parsedRows, mode);
      reset();
      onClose();
    } finally {
      setIsImporting(false);
    }
  }, [parsedRows, mode, onImport, reset, onClose]);

  const canImport = parsedRows && parsedRows.length > 0 && (mode === "append" || replaceConfirmed) && !isImporting;

  const previewHeaders = parsedRows && parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
  const previewRows = parsedRows?.slice(0, 4) ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="import-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Import {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <button
              type="button"
              onClick={() => downloadTemplate(entityName, templateHeaders, exampleRow)}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              data-testid="button-download-template"
            >
              <Download className="h-3.5 w-3.5" />
              Download blank template (.csv)
            </button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use these exact header names (first row). Export CSV from the board uses the same columns so you can edit and re-import.
            </p>
            <p className="text-[11px] font-mono text-muted-foreground break-all">
              {templateHeaders.join(", ")}
            </p>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
              fileName ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            data-testid="import-drop-zone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileInput}
              data-testid="input-import-file"
            />
            {fileName ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{fileName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop a CSV file here</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
              </div>
            )}
          </div>

          {parseError && (
            <Alert variant="destructive" data-testid="import-parse-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {parsedRows && parsedRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Preview — <span className="text-foreground font-semibold">{parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""}</span> found
              </p>
              <div className="rounded-lg border overflow-x-auto max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {previewHeaders.map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {previewHeaders.map(h => (
                          <td key={h} className="px-2 py-1.5 text-foreground whitespace-nowrap max-w-[160px] truncate">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                    {parsedRows.length > 4 && (
                      <tr className="border-t border-border">
                        <td colSpan={previewHeaders.length} className="px-2 py-1.5 text-muted-foreground text-center italic">
                          … and {parsedRows.length - 4} more row{parsedRows.length - 4 !== 1 ? "s" : ""}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">Import mode</p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer group" data-testid="mode-append">
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={mode === "append"}
                  onChange={() => { setMode("append"); setReplaceConfirmed(false); }}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium">Append</span>
                  <p className="text-xs text-muted-foreground">Add imported rows to existing {entityName.toLowerCase()} — nothing is deleted</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group" data-testid="mode-replace">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium">Replace</span>
                  <p className="text-xs text-muted-foreground">Delete all existing {entityName.toLowerCase()} and replace with imported data</p>
                </div>
              </label>
            </div>

            {mode === "replace" && (
              <Alert className="border-destructive/50 bg-destructive/5" data-testid="replace-warning">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>This action cannot be undone.</strong>{" "}
                  {currentCount != null && currentCount > 0
                    ? `All ${currentCount} existing ${entityName.toLowerCase()} will be permanently deleted.`
                    : `All existing ${entityName.toLowerCase()} will be permanently deleted.`}
                </AlertDescription>
              </Alert>
            )}

            {mode === "replace" && (
              <div className="flex items-center gap-2" data-testid="replace-confirm-checkbox">
                <Checkbox
                  id="replaceConfirm"
                  checked={replaceConfirmed}
                  onCheckedChange={(v) => setReplaceConfirmed(!!v)}
                />
                <Label htmlFor="replaceConfirm" className="text-sm cursor-pointer">
                  I understand — delete all existing {entityName.toLowerCase()} and replace
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isImporting} data-testid="button-import-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport}
            data-testid="button-import-confirm"
            className="min-w-[120px]"
          >
            {isImporting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Importing…</>
            ) : (
              `Import${parsedRows ? ` ${parsedRows.length} row${parsedRows.length !== 1 ? "s" : ""}` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
