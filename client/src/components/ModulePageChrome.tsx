import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { cn } from "@/lib/utils";

/**
 * CRM-aligned first-page layout tokens.
 * Use these for module shell / banner / sticky header / tabs / content padding
 * so every module’s chrome matches CRM without changing tab body content.
 */
export const modulePageShellClass = "h-screen overflow-hidden bg-background";
export const modulePageMainClass = "h-full flex flex-col overflow-hidden";
export const modulePageBannerWrapClass =
  "px-3 sm:px-4 pt-3 sm:pt-4 hidden md:block shrink-0";
export const modulePageStickyHeaderClass =
  "border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50 shrink-0";
export const modulePageTabsWrapClass = "px-3 sm:px-4";
export const modulePageTabsListClass =
  "h-11 sm:h-12 bg-transparent border-0 gap-0.5 sm:gap-1 flex w-full max-w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none scroll-smooth";
export const modulePageTabTriggerClass =
  "gap-1.5 sm:gap-2 shrink-0 px-2 sm:px-3 text-xs sm:text-sm rounded-lg whitespace-nowrap";
export const modulePageContentOuterClass = "flex-1 overflow-hidden flex min-h-0";
export const modulePageContentScrollClass = "flex-1 overflow-auto min-w-0";
export const modulePageTabContentClass = "p-3 sm:p-4 md:p-6 m-0";

/** CRM-aligned loading accent (sky spinner). */
export const modulePageLoadingAccentClass = "h-8 w-8 animate-spin text-[#0ea5e9]";

type ModuleHeaderProps = ComponentProps<typeof ModuleHeader>;

/** Centered first-page / content loader matching CRM. */
export function ModulePageLoading({
  label,
  testId,
  className,
}: {
  label: string;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      data-testid={testId}
    >
      <Loader2 className={modulePageLoadingAccentClass} aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Full ModuleShell + centered ModulePageLoading for first-paint module loads. */
export function ModulePageLoadingShell({
  label,
  testId,
}: {
  label: string;
  testId?: string;
}) {
  return (
    <ModuleShell
      className={modulePageShellClass}
      testId={testId}
      mainClassName="h-full flex items-center justify-center overflow-hidden"
    >
      <ModulePageLoading label={label} />
    </ModuleShell>
  );
}

/** In-content / tab loader matching CRM tab loading. */
export function ModuleTabLoading({
  label,
  testId,
  className,
}: {
  label?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16", className)}
      data-testid={testId}
    >
      <Loader2 className={modulePageLoadingAccentClass} aria-hidden />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  );
}

interface ModulePageChromeProps {
  testId?: string;
  moduleKey?: string;
  bannerFeatures?: string[];
  hideBanner?: boolean;
  header: ModuleHeaderProps;
  tabs?: ReactNode;
  children: ReactNode;
  /** Extra content under the welcome banner (alerts, etc.) */
  afterBanner?: ReactNode;
  shellClassName?: string;
  mainClassName?: string;
  contentClassName?: string;
}

/** Standard module first-page chrome matching CRM layout. */
export function ModulePageChrome({
  testId,
  moduleKey,
  bannerFeatures,
  hideBanner = false,
  header,
  tabs,
  children,
  afterBanner,
  shellClassName,
  mainClassName,
  contentClassName,
}: ModulePageChromeProps) {
  return (
    <ModuleShell
      className={cn(modulePageShellClass, shellClassName)}
      testId={testId}
      mainClassName={cn(modulePageMainClass, mainClassName)}
    >
      {!hideBanner && moduleKey ? (
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner moduleKey={moduleKey} features={bannerFeatures} />
          {afterBanner}
        </div>
      ) : afterBanner ? (
        <div className={modulePageBannerWrapClass}>{afterBanner}</div>
      ) : null}

      <div className={modulePageStickyHeaderClass}>
        <ModuleHeader {...header} compact={false} />
        {tabs != null ? <div className={modulePageTabsWrapClass}>{tabs}</div> : null}
      </div>

      <div className={modulePageContentOuterClass}>
        <div className={cn(modulePageContentScrollClass, contentClassName)}>
          {children}
        </div>
      </div>
    </ModuleShell>
  );
}
