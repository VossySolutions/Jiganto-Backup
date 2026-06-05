import { type LucideIcon, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpMenu } from "@/components/HelpMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { QuickActionsDropdown } from "@/components/QuickActionsDropdown";

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
}: ModuleHeaderProps) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold font-display" data-testid={titleTestId}>{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {onSearchChange && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9 w-64 rounded-xl"
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
                className="rounded-xl gap-2"
                data-testid="button-ai-insights"
                onClick={onAIInsightsClick}
              >
                <Sparkles className="h-4 w-4 text-primary" />
                AI Insights
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI-powered insights and recommendations</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
