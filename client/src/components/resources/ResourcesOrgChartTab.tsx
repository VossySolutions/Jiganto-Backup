import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Network, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getInitials } from "./constants";
import { ResourcesTabLoading, ResourcesErrorState, ResourcesEmptyState } from "./ResourcesUi";

type OrgNode = {
  id: number;
  name: string;
  jobTitle: string | null;
  department: string | null;
  photoUrl: string | null;
  personType: string | null;
  reportsToId: number | null;
  children: OrgNode[];
};

type Props = {
  onOpenProfile?: (id: number) => void;
};

function OrgNodeCard({ node, depth, onOpenProfile }: { node: OrgNode; depth: number; onOpenProfile?: (id: number) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className={cn("relative", depth > 0 && "ml-4 sm:ml-6 pl-3 sm:pl-4 border-l border-border/50")}>
      <div className="flex items-start gap-2 sm:gap-3 py-2">
        {hasChildren ? (
          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 shrink-0 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          type="button"
          className="flex items-center gap-2 sm:gap-3 flex-1 text-left rounded-lg p-2 hover:bg-muted/50 transition-colors min-w-0"
          onClick={() => onOpenProfile?.(node.id)}
        >
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
            <AvatarImage src={node.photoUrl ?? undefined} />
            <AvatarFallback className="text-xs">{getInitials(node.name.split(" ")[0], node.name.split(" ").slice(1).join(" "))}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{node.name}</p>
            <p className="text-xs text-muted-foreground truncate">{node.jobTitle ?? "—"} · {node.department ?? "—"}</p>
            {node.personType && <Badge variant="outline" className="text-[10px] mt-1 capitalize">{node.personType}</Badge>}
          </div>
        </button>
      </div>
      {expanded && hasChildren && (
        <div className="space-y-0">
          {node.children.map((child) => (
            <OrgNodeCard key={child.id} node={child} depth={depth + 1} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ResourcesOrgChartTab({ onOpenProfile }: Props) {
  const { data, isLoading, isError, refetch } = useQuery<OrgNode[]>({
    queryKey: ["/api/resources/org-chart"],
  });

  if (isLoading) return <ResourcesTabLoading label="Loading org chart..." />;
  if (isError) return <ResourcesErrorState message="Could not load org chart" onRetry={() => refetch()} />;

  const hasHierarchy = (data ?? []).some((n) => n.reportsToId != null) || (data ?? []).some((n) => n.children.length > 0);

  if (!data?.length) {
    return (
      <ResourcesEmptyState
        icon={Network}
        title="No people in org chart"
        description="Add people and set their Reports To field to build the hierarchy."
      />
    );
  }

  if (!hasHierarchy && data.length > 0) {
    return (
      <Card className="rounded-xl border-border/50">
        <CardContent className="p-4 sm:p-6">
          <ResourcesEmptyState
            icon={Network}
            title="No reporting relationships"
            description='Set "Reports To" on person records to generate the org chart.'
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {data.map((n) => (
              <OrgNodeCard key={n.id} node={{ ...n, children: [] }} depth={0} onOpenProfile={onOpenProfile} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border/50">
      <CardContent className="p-4 sm:p-6 overflow-x-auto">
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Organisation Chart</h3>
          <Badge variant="secondary" className="text-xs">Reports-to hierarchy</Badge>
        </div>
        {data.map((node) => (
          <OrgNodeCard key={node.id} node={node} depth={0} onOpenProfile={onOpenProfile} />
        ))}
      </CardContent>
    </Card>
  );
}
