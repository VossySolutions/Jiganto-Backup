import { useState, useRef } from "react";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmTestSuite } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileText, CheckCircle2, Loader2, X } from "lucide-react";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

interface ParsedRow {
  title: string;
  description: string;
  priority: string;
  caseType: string;
  tags: string;
  estimatedDuration: string;
  preconditions: string;
}

const TEMPLATE_HEADERS = ["title","description","priority","caseType","tags","estimatedDuration","preconditions"];
const TEMPLATE_EXAMPLE: ParsedRow[] = [
  {
    title: "Login with valid credentials",
    description: "Verify user can login with correct username and password",
    priority: "high",
    caseType: "manual",
    tags: "smoke,UAT",
    estimatedDuration: "5",
    preconditions: "User account exists. Application is running.",
  },
  {
    title: "Login with invalid password",
    description: "Verify system shows error for incorrect password",
    priority: "medium",
    caseType: "manual",
    tags: "negative,SIT",
    estimatedDuration: "5",
    preconditions: "User account exists.",
  },
];

function downloadCsv(filename: string, rows: Record<string, string>[], headers: string[]) {
  const header = headers.join(",");
  const lines = rows.map(r => headers.map(h => `"${(r[h] ?? "").replace(/"/g, '""')}"`).join(","));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? [];
    const row: any = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").replace(/^"|"$/g, "").trim(); });
    return row as ParsedRow;
  }).filter(r => r.title);
}

export function ImportTemplatesScreen() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [targetSuiteId, setTargetSuiteId] = useState<number | "">("");
  const [importing, setImporting] = useState(false);

  const {
    data: suites = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTmFetch<TmTestSuite[]>(["/api/tm/suites"], "/api/tm/suites");

  const previewPagination = useTablePagination(parsed ?? [], {
    resetKey: parsed?.length ?? 0,
    enabled: !!parsed?.length,
  });

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast({ title: "No valid rows found", description: "Check the CSV format matches the template.", variant: "destructive" });
        return;
      }
      setParsed(rows);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!parsed) return;
    setImporting(true);
    try {
      let successCount = 0;
      for (const row of parsed) {
        await apiRequest("POST", "/api/tm/cases", {
          suiteId: targetSuiteId || null,
          title: row.title,
          description: row.description || null,
          priority: row.priority || "medium",
          caseType: row.caseType || "manual",
          status: "active",
          tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          estimatedDuration: row.estimatedDuration ? parseInt(row.estimatedDuration) : null,
          preconditions: row.preconditions || null,
        });
        successCount++;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] });
      toast({ title: `Imported ${successCount} test cases`, description: "Test cases are now in the Test Cases library." });
      setParsed(null);
      setFileName("");
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading import templates..."
    >
      <div className="p-6 space-y-8 max-w-4xl">
        <div>
          <h2 className="text-xl font-semibold mb-1">Import & Templates</h2>
          <p className="text-sm text-muted-foreground">Import test cases from CSV, or download starter templates.</p>
        </div>

      {/* Import Section */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Import Test Cases from CSV</span>
        </div>
        <div className="p-6 space-y-5">
          {!parsed ? (
            <div
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              data-testid="csv-dropzone"
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Drop your CSV file here, or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports CSV format. Download the template below for the correct column structure.</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                data-testid="input-file-csv"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{fileName}</span>
                <span className="text-xs text-muted-foreground">{parsed.length} rows detected</span>
                <button onClick={() => { setParsed(null); setFileName(""); }} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Preview (first {Math.min(parsed.length, 5)} of {parsed.length} rows)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold">Title</th>
                        <th className="text-left px-3 py-2 font-semibold">Priority</th>
                        <th className="text-left px-3 py-2 font-semibold">Type</th>
                        <th className="text-left px-3 py-2 font-semibold">Tags</th>
                        <th className="text-left px-3 py-2 font-semibold">Est. (min)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {parsed.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2 max-w-[260px] truncate">{row.title}</td>
                          <td className="px-3 py-2 capitalize">{row.priority}</td>
                          <td className="px-3 py-2 capitalize">{row.caseType}</td>
                          <td className="px-3 py-2">{row.tags}</td>
                          <td className="px-3 py-2">{row.estimatedDuration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={previewPagination.page}
                  totalPages={previewPagination.totalPages}
                  total={previewPagination.total}
                  startIndex={previewPagination.startIndex}
                  endIndex={previewPagination.endIndex}
                  pageSize={previewPagination.pageSize}
                  onPageChange={previewPagination.setPage}
                  onPageSizeChange={previewPagination.setPageSize}
                />
              </div>

              {/* Suite Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium">Import into suite:</label>
                <select
                  className="border border-border rounded px-2.5 py-1.5 text-sm bg-background"
                  value={targetSuiteId}
                  onChange={e => setTargetSuiteId(e.target.value ? parseInt(e.target.value) : "")}
                  data-testid="select-target-suite"
                >
                  <option value="">— No suite (ungrouped) —</option>
                  {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button
                  className="gap-2"
                  onClick={doImport}
                  disabled={importing}
                  data-testid="btn-confirm-import"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import {parsed.length} Test Cases
                </Button>
              </div>
            </div>
          )}
        </div>
        </div>

      {/* Templates Section */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Download Templates</span>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              label: "Blank CSV Template",
              desc: "Empty CSV with all required columns. Fill in your test cases and import above.",
              action: () => downloadCsv("test-cases-template.csv", [], TEMPLATE_HEADERS),
              testId: "btn-download-blank-template",
            },
            {
              label: "Example CSV Template",
              desc: "CSV with 2 example rows showing the expected format for each column.",
              action: () => downloadCsv("test-cases-example.csv", TEMPLATE_EXAMPLE as any, TEMPLATE_HEADERS),
              testId: "btn-download-example-template",
            },
          ].map(item => (
            <div key={item.label} className="border border-border rounded-xl p-4 flex gap-4 items-start">
              <div className="bg-primary/10 rounded-lg p-2.5 flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm mb-1">{item.label}</div>
                <div className="text-xs text-muted-foreground mb-3">{item.desc}</div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={item.action} data-testid={item.testId}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Column guide */}
        <div className="px-6 pb-6">
          <div className="bg-muted/40 rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">CSV Column Reference</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { col: "title", req: true, note: "Test case name (required)" },
                { col: "description", req: false, note: "What is being verified" },
                { col: "priority", req: false, note: "low / medium / high / critical" },
                { col: "caseType", req: false, note: "manual / automated" },
                { col: "tags", req: false, note: "Comma-separated, e.g. UAT,smoke" },
                { col: "estimatedDuration", req: false, note: "Minutes as a number" },
                { col: "preconditions", req: false, note: "Setup required before execution" },
              ].map(({ col, req, note }) => (
                <div key={col} className="text-xs">
                  <span className="font-mono text-primary">{col}</span>
                  {req && <span className="text-red-500 ml-0.5">*</span>}
                  <div className="text-muted-foreground">{note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </TmScreenShell>
  );
}
