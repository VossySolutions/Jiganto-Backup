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
  added: "border-green-500 text-green-600",
  removed: "border-red-500 text-red-600",
  changed: "border-amber-500 text-amber-600",
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
      <div className="max-h-48 overflow-auto px-4 pb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-1.5 pr-2">Step</th>
              <th className="text-left py-1.5 pr-2">Change</th>
              <th className="text-left py-1.5">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: DeltaStepRow) => (
              <tr key={r.stepId + r.changeType} className="border-b border-border/30" data-testid={`delta-row-${r.stepId}`}>
                <td className="py-1.5 pr-2 font-medium">{r.stepName}</td>
                <td className="py-1.5 pr-2">
                  <Badge variant="outline" className={`text-[10px] capitalize ${CHANGE_COLORS[r.changeType]}`}>{r.changeType}</Badge>
                </td>
                <td className="py-1.5 text-muted-foreground">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
