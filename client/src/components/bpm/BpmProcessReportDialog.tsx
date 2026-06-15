import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportProcessReportCsv } from "@/lib/bpm-utils";

type Props = {
  diagramId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ProcessReport = {
  diagramName: string;
  totalCost: number;
  totalDuration: number;
  totalFte: number;
  stepCount: number;
  automationPercent: number;
  riskSummary?: { label: string; risk: string }[];
};

export function BpmProcessReportDialog({ diagramId, open, onOpenChange }: Props) {
  const { data: report, isLoading } = useQuery<ProcessReport>({
    queryKey: [`/api/bpm/diagrams/${diagramId}/process-report`],
    enabled: open && !!diagramId,
  });

  const handleExportCsv = () => {
    if (!report) return;
    const csv = exportProcessReportCsv(report);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(report.diagramName || "process").replace(/\s+/g, "_")}_report.csv`;
    a.click();
  };

  const handleExportPdf = async () => {
    if (!report) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(`Process Report: ${report.diagramName}`, 14, 20);
    pdf.setFontSize(11);
    const lines = [
      `Total Cost: $${report.totalCost?.toLocaleString()}`,
      `Total Duration: ${report.totalDuration} min`,
      `Total FTE: ${report.totalFte}`,
      `Steps: ${report.stepCount}`,
      `Automation: ${report.automationPercent}%`,
    ];
    lines.forEach((l, i) => pdf.text(l, 14, 35 + i * 8));
    if (report.riskSummary?.length) {
      pdf.text("Risk Summary:", 14, 80);
      report.riskSummary.slice(0, 10).forEach((r: any, i: number) => {
        pdf.text(`  ${r.label}: ${r.risk}`, 14, 90 + i * 7);
      });
    }
    pdf.save(`${report.diagramName.replace(/\s+/g, "_")}_report.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-process-report">
        <DialogHeader>
          <DialogTitle>Process Report</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : report ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{report.diagramName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border text-center">
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-lg font-bold" data-testid="report-total-cost">${report.totalCost?.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-md border text-center">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-lg font-bold" data-testid="report-total-duration">{report.totalDuration} min</p>
              </div>
              <div className="p-3 rounded-md border text-center">
                <p className="text-xs text-muted-foreground">FTE Required</p>
                <p className="text-lg font-bold">{report.totalFte}</p>
              </div>
              <div className="p-3 rounded-md border text-center">
                <p className="text-xs text-muted-foreground">Automation</p>
                <p className="text-lg font-bold">{report.automationPercent}%</p>
              </div>
            </div>
            {(report.riskSummary?.length ?? 0) > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Risk by Step</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {(report.riskSummary ?? []).map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{r.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-2">{r.risk}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={handleExportCsv} data-testid="button-export-report-csv">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleExportPdf} data-testid="button-export-report-pdf">
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
