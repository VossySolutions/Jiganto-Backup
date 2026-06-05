import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import {
  bannerLeftClass,
  mainContentMarginClass,
  mainContentPaddingClass,
  mobileTopBarOffsetClass,
  sidebarWidthClass,
} from "@/lib/shell-layout";

/** Layout tokens for sidebar + main content (desktop collapse + mobile drawer). */
export function useShellLayout() {
  const isMobile = useIsMobile();
  const { isCollapsed, mobileNavOpen, setMobileNavOpen } = useSidebarState();
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  return {
    isMobile,
    isCollapsed,
    effectiveCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    openMobileNav: () => setMobileNavOpen(true),
    closeMobileNav: () => setMobileNavOpen(false),
    toggleMobileNav: () => setMobileNavOpen((open) => !open),
    sidebarWidth: sidebarWidthClass(effectiveCollapsed, isMobile),
    mainOffset: mainContentPaddingClass(isCollapsed, isMobile),
    mainMargin: mainContentMarginClass(isCollapsed, isMobile),
    bannerLeft: bannerLeftClass(isCollapsed, isMobile),
    mobileTopOffset: mobileTopBarOffsetClass(isMobile),
  };
}
