import { useState, useMemo, useEffect } from "react";
import { 
  useReactTable, 
  getCoreRowModel, 
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Plus, Hash, Filter, X, ChevronDown } from "lucide-react";
import { type Column, type Item } from "@shared/schema";
import { AttributeRenderer, AddColumnDropdown } from "@/components/attributes";
import { ATTRIBUTE_TYPE_INFO, type AttributeType } from "@shared/attributeTypes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TableViewProps {
  columns: Column[];
  items: Item[];
  onItemClick?: (item: Item) => void;
  onAddColumn?: (columnData: { title: string; key: string; type: string; options?: Record<string, unknown> }) => void;
  onAddRow?: () => void;
  initialFilters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
}

export function TableView({ columns: columnsData, items: itemsData, onItemClick, onAddColumn, onAddRow, initialFilters = {}, onFiltersChange }: TableViewProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(initialFilters);

  const updateFilters = (newFilters: Record<string, string>) => {
    setActiveFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  useEffect(() => {
    setActiveFilters(initialFilters);
    const newColumnFilters = Object.entries(initialFilters)
      .filter(([_, value]) => Boolean(value))
      .map(([id, value]) => ({ id, value }));
    setColumnFilters(newColumnFilters);
  }, [JSON.stringify(initialFilters)]);
  
  const columnHelper = createColumnHelper<Item>();
  
  const columns = useMemo(() => [
    columnHelper.display({
      id: "rowNum",
      header: () => <span className="text-xs text-muted-foreground">#</span>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono">{row.index + 1}</span>
      ),
      size: 40,
    }),
    ...(columnsData || []).map((col) => 
      columnHelper.accessor(row => (row.values as Record<string, unknown>)[col.key], {
        id: col.key,
        header: ({ column }) => {
          const typeInfo = ATTRIBUTE_TYPE_INFO[col.type as AttributeType];
          const filterValue = activeFilters[col.key] || "";
          
          return (
            <div className="flex items-center gap-1">
              <div className="flex-1 flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {col.title}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {typeInfo?.label}
                </span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-6 w-6 ${filterValue ? 'text-primary' : 'text-muted-foreground/50'}`}
                    data-testid={`filter-${col.key}`}
                  >
                    <Filter className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Filter by {col.title}</p>
                    <Input
                      placeholder="Enter filter value..."
                      value={filterValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateFilters({ ...activeFilters, [col.key]: value });
                        column.setFilterValue(value || undefined);
                      }}
                      className="h-8 text-sm"
                      data-testid={`filter-input-${col.key}`}
                    />
                    {filterValue && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          updateFilters({ ...activeFilters, [col.key]: "" });
                          column.setFilterValue(undefined);
                        }}
                      >
                        <X className="h-3 w-3 mr-1" /> Clear filter
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        },
        cell: info => {
          const value = info.getValue();
          return (
            <div className="font-medium text-sm text-foreground/80 py-1">
              <AttributeRenderer 
                type={col.type} 
                value={value} 
                options={col.options as Record<string, unknown>} 
              />
            </div>
          );
        },
        filterFn: (row, columnId, filterValue) => {
          const cellValue = row.getValue(columnId);
          if (!filterValue) return true;
          const strValue = String(cellValue || "").toLowerCase();
          return strValue.includes(String(filterValue).toLowerCase());
        },
      })
    ),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      size: 50,
    }),
    ...(onAddColumn ? [columnHelper.display({
      id: "addColumn",
      header: () => (
        <AddColumnDropdown onAddColumn={onAddColumn} variant="minimal" />
      ),
      cell: () => null,
      size: 100,
    })] : [])
  ], [columnsData, activeFilters, onAddColumn]);

  const table = useReactTable({
    data: itemsData || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
    },
  });

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg text-sm">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{activeFilterCount} filter(s) active</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs ml-auto"
            onClick={() => {
              updateFilters({});
              setColumnFilters([]);
            }}
          >
            Clear all
          </Button>
        </div>
      )}
      
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map(header => (
                  <TableHead 
                    key={header.id} 
                    className="h-10 border-r border-border/50 last:border-r-0"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map(row => (
                  <TableRow 
                    key={row.id} 
                    data-state={row.getIsSelected() && "selected"}
                    className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onItemClick?.(row.original)}
                    data-testid={`table-row-${row.original.id}`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell 
                        key={cell.id} 
                        className="py-2.5 border-r border-border/30 last:border-r-0"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {onAddRow && (
                  <TableRow 
                    className="border-b border-border hover-elevate cursor-pointer"
                    onClick={onAddRow}
                    data-testid="add-row-btn"
                  >
                    <TableCell colSpan={columns.length} className="py-2">
                      <div className="flex items-center gap-2 text-muted-foreground pl-2">
                        <Plus className="h-4 w-4" />
                        <span className="text-sm">Add Row</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ) : (
              <>
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center border-b border-border">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Hash className="h-5 w-5 opacity-50" />
                      </div>
                      <p>No items found. Add one to get started.</p>
                    </div>
                  </TableCell>
                </TableRow>
                {onAddRow && (
                  <TableRow 
                    className="hover-elevate cursor-pointer"
                    onClick={onAddRow}
                    data-testid="add-row-btn"
                  >
                    <TableCell colSpan={columns.length} className="py-2">
                      <div className="flex items-center gap-2 text-muted-foreground pl-2">
                        <Plus className="h-4 w-4" />
                        <span className="text-sm">Add Row</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
