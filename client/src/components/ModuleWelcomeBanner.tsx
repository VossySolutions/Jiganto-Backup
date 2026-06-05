import { useState, useEffect } from "react";
import { X, Lightbulb, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getModuleByKey, categoryColors } from "@/lib/module-metadata";
import { useAuth } from "@/hooks/use-auth";

const DISMISS_KEY_PREFIX = "jiganto-module-welcome-dismissed-";

interface ModuleWelcomeBannerProps {
  moduleKey: string;
  features?: string[];
}

export function ModuleWelcomeBanner({ moduleKey, features }: ModuleWelcomeBannerProps) {
  const { user } = useAuth();
  const storageKey = `${DISMISS_KEY_PREFIX}${moduleKey}-${user?.id || "anon"}`;

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  const mod = getModuleByKey(moduleKey);

  useEffect(() => {
    if (dismissed) {
      localStorage.setItem(storageKey, "true");
    }
  }, [dismissed, storageKey]);

  if (dismissed || !mod) return null;

  const colors = categoryColors[mod.category];

  return (
    <div
      className={cn(
        "relative rounded-xl border p-5 mb-4",
        "bg-gradient-to-r from-primary/5 via-transparent to-transparent",
        "border-primary/10"
      )}
      data-testid={`welcome-banner-${moduleKey}`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 text-muted-foreground"
        onClick={() => setDismissed(true)}
        data-testid={`dismiss-welcome-${moduleKey}`}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex items-start gap-4">
        <div
          className="p-2.5 rounded-xl shrink-0"
          style={{ backgroundColor: `${mod.color}15` }}
        >
          <mod.icon className="h-6 w-6" style={{ color: mod.color }} />
        </div>

        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground">{mod.name}</h3>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", colors.bg, colors.text)}>
              {mod.category}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {mod.longDescription}
          </p>

          {features && features.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
