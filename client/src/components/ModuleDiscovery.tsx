import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  categoryColors,
  type ModuleCategory,
  getDiscoveryCategories,
  modulesInDiscoveryOrder,
} from "@/lib/module-metadata";
import { DashboardKpiStrip } from "@/components/dashboard/DashboardKpiStrip";
import { useAuth } from "@/hooks/use-auth";
import { useModuleAccess } from "@/hooks/use-module-access";
import { isModuleLicensed, useModuleEntitlements } from "@/hooks/use-module-entitlements";
import { getSettingsAccess } from "@/lib/settings-access";
import { navPathToModuleKey } from "@shared/models/module-access";

function CategoryBadge({ category }: { category: ModuleCategory }) {
  const colors = categoryColors[category];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", colors.bg, colors.text)}>
      {category}
    </span>
  );
}

export function ModuleDiscovery({
  clientId,
  projectId,
  hiddenModuleKeys = [],
}: {
  clientId?: number | null;
  projectId?: number | null;
  hiddenModuleKeys?: string[];
}) {
  const { user } = useAuth();
  const { canAccessNavPath } = useModuleAccess();
  const { data: entitlements } = useModuleEntitlements();
  const settingsAccess = getSettingsAccess(user?.platformRole, user?.isJigantoStaff);
  const includeCommercial = settingsAccess.tier === "system";
  const discoveryCategories = getDiscoveryCategories(includeCommercial);

  const visibleModules = modulesInDiscoveryOrder(includeCommercial)
    .filter((mod) => !hiddenModuleKeys.includes(mod.key))
    .filter((mod) => canAccessNavPath(mod.href))
    .map((mod) => ({
      ...mod,
      locked: !isModuleLicensed(navPathToModuleKey(mod.href) ?? mod.key, entitlements),
    }));

  const grouped = discoveryCategories
    .map((category) => ({
      category,
      modules: visibleModules.filter((m) => m.category === category),
    }))
    .filter((g) => g.modules.length > 0);

  return (
    <div className="space-y-8">
      <DashboardKpiStrip clientId={clientId} projectId={projectId} />

      {grouped.map(({ category, modules }) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {category}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((mod, i) => {
              const card = (
                <Card
                  className={cn(
                    "rounded-xl border-border/50 shadow-sm transition-all h-full",
                    mod.locked
                      ? "opacity-60 cursor-not-allowed bg-muted/30"
                      : "hover:shadow-md hover:border-primary/30 cursor-pointer group",
                  )}
                  data-testid={`module-card-${mod.key}`}
                >
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div
                        className={cn("p-2.5 rounded-xl", mod.locked && "grayscale")}
                        style={{ backgroundColor: `${mod.color}15` }}
                      >
                        <mod.icon className="h-5 w-5" />
                      </div>
                      {mod.locked ? (
                        <Lock className="h-4 w-4 text-muted-foreground mt-1" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-foreground mb-1">{mod.name}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex-1 line-clamp-2">
                      {mod.shortDescription}
                    </p>
                    <CategoryBadge category={mod.category} />
                  </CardContent>
                </Card>
              );

              return (
                <motion.div
                  key={mod.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.03 }}
                >
                  {mod.locked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>{card}</div>
                      </TooltipTrigger>
                      <TooltipContent>Upgrade to unlock this module</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link href={mod.href}>{card}</Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Flat list of authorized (clickable) modules for keyboard shortcuts 1–9 */
export function useModuleDiscoveryShortcuts(hiddenModuleKeys: string[] = []) {
  const { user } = useAuth();
  const { canAccessNavPath } = useModuleAccess();
  const { data: entitlements } = useModuleEntitlements();
  const settingsAccess = getSettingsAccess(user?.platformRole, user?.isJigantoStaff);
  const includeCommercial = settingsAccess.tier === "system";

  return modulesInDiscoveryOrder(includeCommercial)
    .filter((mod) => !hiddenModuleKeys.includes(mod.key))
    .filter((mod) => canAccessNavPath(mod.href))
    .filter((mod) => isModuleLicensed(navPathToModuleKey(mod.href) ?? mod.key, entitlements));
}
