import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, FileCode, File } from "lucide-react";
import { type Column, type Item } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ExportDropdownProps {
  columns: Column[];
  items: Item[];
  boardName: string;
}

export function ExportDropdown({ columns, items, boardName }: ExportDropdownProps) {
  const { toast } = useToast();

  const generateCSV = () => {
    const headers = columns.map(c => c.title).join(",");
    const rows = items.map(item => {
      const values = item.values as Record<string, unknown>;
      return columns.map(col => {
        const val = values[col.key];
        const strVal = val != null ? String(val) : "";
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(",");
    });
    return [headers, ...rows].join("\n");
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const csv = generateCSV();
    downloadFile(csv, `${boardName}.csv`, "text/csv");
    toast({ title: "Export successful", description: "Data exported to CSV" });
  };

  const exportToExcel = () => {
    const csv = generateCSV();
    downloadFile(csv, `${boardName}.xls`, "application/vnd.ms-excel");
    toast({ title: "Export successful", description: "Data exported to Excel format" });
  };

  const exportToHTML = () => {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${boardName}</title>
  <style>
    table { border-collapse: collapse; width: 100%; font-family: system-ui; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h1>${boardName}</h1>
  <table>
    <thead>
      <tr>${columns.map(c => `<th>${c.title}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${items.map(item => {
        const values = item.values as Record<string, unknown>;
        return `<tr>${columns.map(col => `<td>${values[col.key] ?? ""}</td>`).join("")}</tr>`;
      }).join("\n      ")}
    </tbody>
  </table>
</body>
</html>`;
    downloadFile(html, `${boardName}.html`, "text/html");
    toast({ title: "Export successful", description: "Data exported to HTML" });
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>${boardName}</title>
          <style>
            body { font-family: system-ui; padding: 20px; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #eee; font-weight: 600; }
            h1 { font-size: 18px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>${boardName}</h1>
          <table>
            <thead>
              <tr>${columns.map(c => `<th>${c.title}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const values = item.values as Record<string, unknown>;
                return `<tr>${columns.map(col => `<td>${values[col.key] ?? ""}</td>`).join("")}</tr>`;
              }).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    toast({ title: "Print dialog opened", description: "Save as PDF from print dialog" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2" data-testid="export-dropdown">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Data</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToCSV} data-testid="export-csv">
          <FileText className="h-4 w-4 mr-2" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel} data-testid="export-excel">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToHTML} data-testid="export-html">
          <FileCode className="h-4 w-4 mr-2" />
          HTML (.html)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToPDF} data-testid="export-pdf">
          <File className="h-4 w-4 mr-2" />
          PDF (Print)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
