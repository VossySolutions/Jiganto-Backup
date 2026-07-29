import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet } from "lucide-react";
import { buildDeltaReport, exportDeltaReportCsv, type DeltaStepRow } from "@/lib/bpm-utils";

type Props = {
  asIsNodes: any[];
  toBeNodes: any[];
};

const CHANGE_COLORS: Record<string, string> = {
  added: "border-green-500 text-green-600 dark:text-green-400",
  removed: "border-red-500 text-red-600 dark:text-red-400",
  changed: "border-amber-500 text-amber-600 dark:text-amber-400",
  unchanged: "border-muted text-muted-foreground",
};

export function BpmDeltaReportTable({ asIsNodes, toBeNodes }: Props) {
  const rows = useMemo(() => buildDeltaReport(asIsNodes, toBeNodes), [asIsNodes, toBeNodes]);

  const handleExportCsv = () => {
    const csv = exportDeltaReportCsv(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "delta_report.csv";
    a.click();
  };

  const handleExportPptx = async () => {
    const lines = rows.map(r => `${r.stepName}\t${r.changeType}\t${r.details}`);
    const tsv = ["Step Name\tChange Type\tDetails", ...lines].join("\n");
    const blob = new Blob([tsv], { type: "text/tab-separated-values" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "delta_report.tsv";
    a.click();
  };

  return (
    <div className="border-t bg-card" data-testid="delta-report-table">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium">Delta Report</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCsv} data-testid="button-export-delta-csv">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPptx} data-testid="button-export-delta-ppt">
            <Download className="h-3.5 w-3.5 mr-1" /> PowerPoint
          </Button>
        </div>
      </div>
      <div className="max-h-48 overflow-auto overflow-x-auto px-4 pb-3">
        <table className="w-full text-sm text-gray-700 dark:text-foreground">
          <thead>
            <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
              <th className="px-3 py-2.5 text-left align-middle font-semibold">Step</th>
              <th className="px-3 py-2.5 text-left align-middle font-semibold">Change</th>
              <th className="px-3 py-2.5 text-left align-middle font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: DeltaStepRow) => (
              <tr key={r.stepId + r.changeType} className="border-b border-border/40 hover:bg-muted/30" data-testid={`delta-row-${r.stepId}`}>
                <td className="px-3 py-2.5 align-middle font-medium">{r.stepName}</td>
                <td className="px-3 py-2.5 align-middle">
                  <Badge variant="outline" className={`text-[10px] capitalize ${CHANGE_COLORS[r.changeType]}`}>{r.changeType}</Badge>
                </td>
                <td className="px-3 py-2.5 align-middle text-muted-foreground">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
