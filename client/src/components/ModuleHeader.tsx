import { type LucideIcon, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpMenu } from "@/components/HelpMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { QuickActionsDropdown } from "@/components/QuickActionsDropdown";
import { cn } from "@/lib/utils";

interface ModuleHeaderProps {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchTestId?: string;
  titleTestId?: string;
  actions?: React.ReactNode;
  onAIInsightsClick?: () => void;
  compact?: boolean;
}

export function ModuleHeader({
  icon: Icon,
  title,
  subtitle,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  searchTestId = "input-module-search",
  titleTestId = "text-module-title",
  actions,
  onAIInsightsClick,
  compact = false,
}: ModuleHeaderProps) {
  return (
    <div className={cn(compact ? "px-4 py-2" : "p-4")}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shrink-0",
              compact ? "p-1.5" : "p-2",
            )}
          >
            <Icon className={cn("text-primary", compact ? "h-4 w-4" : "h-6 w-6")} />
          </div>
          <div className="min-w-0">
            <h1
              className={cn("font-semibold font-display truncate", compact ? "text-base" : "text-xl")}
              data-testid={titleTestId}
            >
              {title}
            </h1>
            {subtitle && (
              <p className={cn("text-muted-foreground truncate", compact ? "text-xs" : "text-sm")}>{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          {onSearchChange && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9 w-full rounded-xl"
                value={searchValue || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                data-testid={searchTestId}
              />
            </div>
          )}
          {actions}
          <Tooltip>
            <TooltipTrigger asChild>
              <div><HelpMenu /></div>
            </TooltipTrigger>
            <TooltipContent>Feedback & Help</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><NotificationBell /></div>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><QuickActionsDropdown /></div>
            </TooltipTrigger>
            <TooltipContent>Quick Actions</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn("rounded-xl gap-2", compact && "h-8 text-xs px-2.5")}
                data-testid="button-ai-insights"
                onClick={onAIInsightsClick}
              >
                <Sparkles className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                {!compact && "AI Insights"}
                {compact && <span className="hidden md:inline">AI Insights</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI-powered insights and recommendations</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
