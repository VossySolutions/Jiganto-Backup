import { Link } from "wouter";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, AlertCircle, DollarSign, Users, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { moduleMetadata, categoryColors, type ModuleCategory } from "@/lib/module-metadata";

const kpiMetrics = [
  { label: "Active Items", value: "14", icon: Activity, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { label: "At Risk", value: "4", icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
  { label: "Critical", value: "2", icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  { label: "Portfolio Budget", value: "£4.2M", icon: DollarSign, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
  { label: "Team Members", value: "23", icon: Users, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
];

function CategoryBadge({ category }: { category: ModuleCategory }) {
  const colors = categoryColors[category];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", colors.bg, colors.text)}>
      {category}
    </span>
  );
}

export function ModuleDiscovery() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiMetrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", metric.bg)}>
                  <metric.icon className={cn("h-5 w-5", metric.color)} />
                </div>
                <div>
                  <div className="text-xl font-bold font-display">{metric.value}</div>
                  <div className="text-xs text-muted-foreground">{metric.label}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4" data-testid="all-modules-heading">All Modules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {moduleMetadata.map((mod, i) => (
            <motion.div
              key={mod.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.03 }}
            >
              <Link href={mod.href}>
                <Card
                  className="rounded-xl border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group h-full"
                  data-testid={`module-card-${mod.key}`}
                >
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div
                        className="p-2.5 rounded-xl"
                        style={{ backgroundColor: `${mod.color}15` }}
                      >
                        <mod.icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground mb-1" data-testid={`module-name-${mod.key}`}>{mod.name}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex-1">{mod.longDescription}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={mod.category} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
