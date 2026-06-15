import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Link2, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "wouter";

type Props = {
  diagramId: number;
  nodeId: string;
  nodeLabel: string;
};

export function BpmTestCoverageBadge({ diagramId, nodeId }: { diagramId: number; nodeId: string }) {
  const { data: links = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/bpm/diagrams/${diagramId}/step-links?nodeId=${encodeURIComponent(nodeId)}`],
    enabled: !!diagramId && !!nodeId,
  });
  const testLinks = links.filter(l => l.linkType === "test_scenario");
  if (isLoading) return null;
  if (!testLinks.length) return null;
  const passed = testLinks.filter(l => l.metadata?.status === "passed").length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="absolute -top-2 -right-2 z-10" data-testid="badge-test-coverage">
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 cursor-pointer">
            {testLinks.length} tests · {passed} passed
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" data-testid="popover-test-coverage">
        <p className="text-xs font-medium mb-2">Linked Test Scenarios</p>
        <div className="space-y-1 mb-2">
          {testLinks.map(l => (
            <div key={l.id} className="flex items-center justify-between text-xs">
              <span className="truncate flex-1">{l.label || `Scenario #${l.targetId}`}</span>
              <Badge variant="outline" className="text-[9px] ml-1">{l.metadata?.status || "pending"}</Badge>
            </div>
          ))}
        </div>
        <Link href="/modules/test-mgmt">
          <Button size="sm" variant="outline" className="w-full text-xs" data-testid="button-view-test-mgmt">
            <ExternalLink className="h-3 w-3 mr-1" /> View in Test Management
          </Button>
        </Link>
      </PopoverContent>
    </Popover>
  );
}

export function BpmStepLinksPanel({ diagramId, nodeId, nodeLabel }: Props) {
  const [linkType, setLinkType] = useState("test_scenario");
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");

  const { data: links = [], isLoading: linksLoading } = useQuery<any[]>({
    queryKey: [`/api/bpm/diagrams/${diagramId}/step-links`],
    enabled: !!diagramId,
  });

  const nodeLinks = links.filter(l => l.nodeId === nodeId);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", `/api/bpm/diagrams/${diagramId}/step-links`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bpm/diagrams/${diagramId}/step-links`] });
      setTargetId(""); setLabel("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/bpm/step-links/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/bpm/diagrams/${diagramId}/step-links`] }),
  });

  return (
    <div className="space-y-2 pt-2 border-t" data-testid="step-links-panel">
      <p className="text-xs font-medium flex items-center gap-1"><Link2 className="h-3 w-3" /> Cross-Module Links</p>
      {linksLoading ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading links…
        </div>
      ) : nodeLinks.map(l => (
        <div key={l.id} className="flex items-center gap-1 text-xs">
          <Badge variant="outline" className="text-[9px]">{l.linkType.replace(/_/g, " ")}</Badge>
          <span className="flex-1 truncate">{l.label || `#${l.targetId}`}</span>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteMutation.mutate(l.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-1 flex-wrap sm:flex-nowrap">
        <Select value={linkType} onValueChange={setLinkType}>
          <SelectTrigger className="h-7 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="test_scenario">Test Scenario</SelectItem>
            <SelectItem value="help_desk_incident">Help Desk</SelectItem>
            <SelectItem value="document">Document</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="ID" value={targetId} onChange={e => setTargetId(e.target.value)} className="h-7 text-xs flex-1" />
        <Button size="sm" className="h-7 px-2" disabled={!targetId} onClick={() => createMutation.mutate({
          nodeId, linkType, targetId: Number(targetId), label: label || nodeLabel,
        })} data-testid="button-add-step-link">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
