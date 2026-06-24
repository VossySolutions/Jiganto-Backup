import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { type Column } from "@shared/schema";

interface ImportDropdownProps {
  columns: Column[];
  onImport: (items: Record<string, unknown>[]) => void;
}

export function ImportDropdown({ columns, onImport }: ImportDropdownProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseCSV = (text: string): Record<string, unknown>[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const items: Record<string, unknown>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const item: Record<string, unknown> = {};
      
      headers.forEach((header, index) => {
        const column = columns.find(c => 
          c.title.toLowerCase() === header.toLowerCase() || 
          c.key.toLowerCase() === header.toLowerCase()
        );
        if (column) {
          item[column.key] = values[index] || '';
        }
      });
      
      if (Object.keys(item).length > 0) {
        items.push(item);
      }
    }
    
    return items;
  };

  const handleFileSelect = (type: 'csv' | 'excel') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'csv' ? '.csv' : '.xlsx,.xls';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (file.name.endsWith('.csv')) {
      const text = await file.text();
      const items = parseCSV(text);
      setPreviewData(items);
      setIsPreviewOpen(true);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) {
          toast({ title: "Empty workbook", description: "No sheets found in the Excel file.", variant: "destructive" });
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const items: Record<string, unknown>[] = [];
        for (const row of rows) {
          const item: Record<string, unknown> = {};
          for (const [header, value] of Object.entries(row)) {
            const column = columns.find(c =>
              c.title.toLowerCase() === String(header).toLowerCase() ||
              c.key.toLowerCase() === String(header).toLowerCase(),
            );
            if (column) item[column.key] = value ?? "";
          }
          if (Object.keys(item).length > 0) items.push(item);
        }
        if (items.length === 0) {
          toast({ title: "No matching columns", description: "Excel headers must match board column names.", variant: "destructive" });
          return;
        }
        setPreviewData(items);
        setIsPreviewOpen(true);
      } catch {
        toast({ title: "Excel import failed", description: "Could not read the file. Try saving as CSV.", variant: "destructive" });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (previewData.length > 0) {
      onImport(previewData);
      toast({
        title: "Import Successful",
        description: `Imported ${previewData.length} items successfully.`
      });
    }
    setIsPreviewOpen(false);
    setPreviewData([]);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5" data-testid="import-dropdown">
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => handleFileSelect('csv')} data-testid="import-csv">
            <FileText className="h-4 w-4 mr-2" />
            Import CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFileSelect('excel')} data-testid="import-excel">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import Excel
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => {
              const headers = columns.map(c => c.title).join(',');
              const blob = new Blob([headers], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'template.csv';
              a.click();
            }}
            data-testid="download-template"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Importing {previewData.length} items from {fileName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left font-medium border-b">#</th>
                  {columns.slice(0, 5).map(col => (
                    <th key={col.key} className="p-2 text-left font-medium border-b">
                      {col.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 10).map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    {columns.slice(0, 5).map(col => (
                      <td key={col.key} className="p-2">
                        {String(item[col.key] || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {previewData.length > 10 && (
            <p className="text-sm text-muted-foreground">
              ...and {previewData.length - 10} more items
            </p>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} data-testid="confirm-import">
              Import {previewData.length} Items
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
