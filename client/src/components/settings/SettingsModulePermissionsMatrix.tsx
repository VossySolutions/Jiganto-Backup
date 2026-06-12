import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Grid3x3 } from "lucide-react";
import { SETTINGS_MODULE_KEYS } from "@shared/models/module-access";
import { TablePagination } from "@/components/TablePagination";
import { useTablePagination } from "@/hooks/use-table-pagination";

/** Reference for legacy module role permission keys. */
export default function SettingsModulePermissionsMatrix() {
  const moduleRowsPagination = useTablePagination(SETTINGS_MODULE_KEYS, {
    resetKey: SETTINGS_MODULE_KEYS.length,
  });

  return (
    <Card data-testid="module-permissions-matrix">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Grid3x3 className="h-4 w-4" />
          Module permission keys
        </CardTitle>
        <CardDescription>
          Legacy roles grant <strong>Read</strong> (view + GET), <strong>Write</strong> (create/update),
          and <strong>Share</strong> (documents, planned). Platform roles ignore this matrix. Per-user
          overrides are set in Users → user detail.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="font-mono text-xs">moduleKey</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moduleRowsPagination.paginatedItems.map((mod) => (
              <TableRow key={mod.key}>
                <TableCell className="font-medium">{mod.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{mod.key}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={moduleRowsPagination.page}
          totalPages={moduleRowsPagination.totalPages}
          total={moduleRowsPagination.total}
          startIndex={moduleRowsPagination.startIndex}
          endIndex={moduleRowsPagination.endIndex}
          pageSize={moduleRowsPagination.pageSize}
          onPageChange={moduleRowsPagination.setPage}
          onPageSizeChange={moduleRowsPagination.setPageSize}
        />
      </CardContent>
    </Card>
  );
}
