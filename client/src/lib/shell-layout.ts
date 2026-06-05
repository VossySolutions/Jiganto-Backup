/** Shared app shell dimensions (sidebar, main offset, context banner). */

export const SIDEBAR_WIDTH_EXPANDED_PX = 260;
export const SIDEBAR_WIDTH_COLLAPSED_PX = 70;
export const MOBILE_TOP_BAR_HEIGHT_PX = 48;

export const SIDEBAR_WIDTH_EXPANDED = "w-[260px]";
export const SIDEBAR_WIDTH_COLLAPSED = "w-[70px]";
export const SIDEBAR_WIDTH_MOBILE = "w-[min(280px,88vw)]";

export function sidebarWidthClass(collapsed: boolean, isMobile: boolean): string {
  if (isMobile) return SIDEBAR_WIDTH_MOBILE;
  return collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
}

/** Left padding for page <main> regions beside the fixed sidebar. */
export function mainContentPaddingClass(
  collapsed: boolean,
  isMobile: boolean,
): string {
  if (isMobile) return "pl-0";
  return collapsed ? "pl-[70px]" : "pl-[260px]";
}

/** Left margin when padding is not appropriate (nested panels). */
export function mainContentMarginClass(
  collapsed: boolean,
  isMobile: boolean,
): string {
  if (isMobile) return "ml-0";
  return collapsed ? "ml-[70px]" : "ml-[260px]";
}

/** Offset for fixed context banner below the sidebar edge. */
export function bannerLeftClass(collapsed: boolean, isMobile: boolean): string {
  if (isMobile) return "left-0";
  return collapsed ? "left-[70px]" : "left-[260px]";
}

export function mobileTopBarOffsetClass(isMobile: boolean): string {
  return isMobile ? "pt-12" : "";
}
