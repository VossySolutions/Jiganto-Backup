import { useState, useEffect, useMemo } from "react";

export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type TablePaginationOptions = {
  defaultPageSize?: number;
  resetKey?: string | number;
  enabled?: boolean;
};

export function useTablePagination<T>(
  items: T[],
  options?: TablePaginationOptions
) {
  const enabled = options?.enabled !== false;
  const defaultPageSize = options?.defaultPageSize ?? 25;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [options?.resetKey, pageSize]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    if (!enabled) return items;
    return items.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [items, safePage, pageSize, enabled]);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    paginatedItems,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    startIndex: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    endIndex: Math.min(safePage * pageSize, total),
    enabled,
  };
}
