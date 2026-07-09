import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

/** Read `?tab=` from the current URL, validated against allowed values. */
export function readModuleTabFromUrl(allowedTabs: readonly string[], fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab && allowedTabs.includes(tab) ? tab : fallback;
}

/** Write `?tab=` via replaceState (for one-off deep-link cleanup). Preserves other query params. */
export function writeModuleTabToUrl(tab: string, defaultTab: string, omitDefault = true): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (omitDefault && tab === defaultTab) {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }
  const qs = url.searchParams.toString();
  window.history.replaceState({}, "", qs ? `${url.pathname}?${qs}` : url.pathname);
}

function tabFromSearch(search: string, allowedTabs: readonly string[], defaultTab: string): string {
  const tab = new URLSearchParams(search).get("tab");
  return tab && allowedTabs.includes(tab) ? tab : defaultTab;
}

function locationWithSearch(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Sync module tab state with `?tab=` in the URL (wouter-aware).
 * - Default tab omits `tab` from the URL.
 * - Re-reads tab when search string changes (sidebar links, setLocation, back/forward).
 * - Preserves other query params when the tab changes.
 */
export function useModuleTabUrl<T extends string>(
  allowedTabs: readonly T[],
  defaultTab: T,
  options?: { omitDefault?: boolean },
): [T, (tab: string) => void] {
  const omitDefault = options?.omitDefault !== false;
  const [pathname, setLocation] = useLocation();
  const search = useSearch();

  const resolveTab = useCallback(
    (raw: string): T => ((allowedTabs as readonly string[]).includes(raw) ? raw : defaultTab) as T,
    [allowedTabs, defaultTab],
  );

  const [activeTab, setActiveTabState] = useState<T>(() =>
    resolveTab(tabFromSearch(search, allowedTabs as readonly string[], defaultTab)),
  );

  // Wouter's useLocation is pathname-only; useSearch tracks ?tab= changes.
  useEffect(() => {
    const next = resolveTab(tabFromSearch(search, allowedTabs as readonly string[], defaultTab));
    setActiveTabState((prev) => (prev === next ? prev : next));
  }, [search, allowedTabs, defaultTab, resolveTab]);

  const setActiveTab = useCallback(
    (tab: string) => {
      const next = resolveTab(tab);
      setActiveTabState(next);

      const params = new URLSearchParams(search);
      if (omitDefault && next === defaultTab) {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      const current = locationWithSearch(pathname, search);
      if (target !== current) {
        setLocation(target);
      }
    },
    [pathname, search, setLocation, resolveTab, defaultTab, omitDefault],
  );

  return [activeTab, setActiveTab];
}
