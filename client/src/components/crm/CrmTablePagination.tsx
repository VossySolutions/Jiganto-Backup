import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRM_PAGE_SIZE_OPTIONS } from "@/hooks/use-crm-pagination";

interface CrmTablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  startIndex: number;
  endIndex: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
  extra?: React.ReactNode;
}

export function CrmTablePagination({
  page,
  totalPages,
  total,
  startIndex,
  endIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
  extra,
}: CrmTablePaginationProps) {
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 border-t border-border/40 bg-muted/20",
        className
      )}
      data-testid="crm-table-pagination"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Showing {startIndex}–{endIndex} of {total}
        </span>
        {extra}
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-[110px] text-xs" data-testid="select-page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          data-testid="button-page-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[3.5rem] text-center" data-testid="text-page-info">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          data-testid="button-page-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
