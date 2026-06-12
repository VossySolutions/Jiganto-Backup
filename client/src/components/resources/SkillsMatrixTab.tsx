import { useState } from "react";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Grid3X3, Search, Plus, Download, Target, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getInitials, getProficiencyConfig, PROFICIENCY_LEVELS } from "./constants";
import { ResourcesTableSkeleton, ResourcesTabLoading, ResourcesEmptyState } from "./ResourcesUi";
import type { Resource, Skill, SkillCategory, ResourceSkill } from "@shared/models/resources";

type SearchResult = Resource & { utilisationPct: number; matchingSkills: Array<{ name: string; level: number }> };

type Props = {
  resources: Resource[];
  skills: Skill[];
  categories: SkillCategory[];
  resourceSkills: Record<number, ResourceSkill[]>;
  isLoading?: boolean;
  onOpenProfile: (r: Resource) => void;
};

export function SkillsMatrixTab({ resources, skills, categories, resourceSkills, isLoading, onOpenProfile }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<"matrix" | "search">("matrix");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showGap, setShowGap] = useState(false);
  const [gapPlanId, setGapPlanId] = useState("");
  const [gapResults, setGapResults] = useState<Array<{ role: string; coverage: string; qualifiedCount: number; candidates: string[] }>>([]);
  const [searchCriteria, setSearchCriteria] = useState<Array<{ skillId: string; minLevel: string; minYears: string }>>([{ skillId: "", minLevel: "3", minYears: "0" }]);
  const [searchLogic, setSearchLogic] = useState<"and" | "or">("and");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [gapLoading, setGapLoading] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("");
  const [isCertification, setIsCertification] = useState(false);

  const matrixPagination = useTablePagination(resources, {
    resetKey: `${view}-${resources.length}`,
    enabled: view === "matrix",
  });
  const searchPagination = useTablePagination(searchResults, {
    resetKey: searchResults.length,
    enabled: view === "search",
  });

  const createSkillMutation = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/resources/skills", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/skills"] });
      toast({ title: "Skill created" });
      setShowAdmin(false);
    },
  });

  const runSearch = async () => {
    setSearchLoading(true);
    try {
      const criteria = searchCriteria
        .filter((c) => c.skillId)
        .map((c) => ({ skillId: Number(c.skillId), minLevel: Number(c.minLevel), minYears: Number(c.minYears) }));
      const res = await apiRequest("POST", "/api/resources/skills/search", { criteria, logic: searchLogic });
      setSearchResults(await res.json());
    } finally {
      setSearchLoading(false);
    }
  };

  const runGap = async () => {
    if (!gapPlanId) return;
    setGapLoading(true);
    try {
      const res = await fetch(`/api/resources/skills/gap-analysis/${gapPlanId}`, { credentials: "include" });
      if (res.ok) setGapResults(await res.json());
    } finally {
      setGapLoading(false);
    }
  };

  const exportSearchCsv = () => {
    const lines = ["Name,Title,Utilisation,Skills"];
    searchResults.forEach((r) => {
      lines.push(`"${r.firstName} ${r.lastName}","${r.jobTitle ?? ""}",${r.utilisationPct},"${r.matchingSkills.map((s) => s.name).join("; ")}"`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "skill-search-results.csv";
    a.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ResourcesTableSkeleton rows={10} cols={6} />
      </div>
    );
  }

  if (skills.length === 0 && view === "matrix") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="font-medium">No skills defined</p>
          <Button className="mt-4" onClick={() => setShowAdmin(true)}><Plus className="h-4 w-4 mr-1" /> Add skills</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant={view === "matrix" ? "default" : "outline"} size="sm" onClick={() => setView("matrix")}>
            <Grid3X3 className="h-4 w-4 mr-1" /> Matrix
          </Button>
          <Button variant={view === "search" ? "default" : "outline"} size="sm" onClick={() => setView("search")}>
            <Search className="h-4 w-4 mr-1" /> Search
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGap(true)}><Target className="h-4 w-4 mr-1" /> Gap Analysis</Button>
          <Button variant="outline" size="sm" onClick={() => setShowAdmin(true)}><Plus className="h-4 w-4 mr-1" /> Manage Skills</Button>
        </div>
      </div>

      {view === "matrix" ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="sticky left-0 bg-muted p-3 text-left text-xs min-w-[180px]">Resource</th>
                  {skills.map((s) => (
                    <th key={s.id} className="p-2 text-xs text-center min-w-[72px]">
                      <div className="truncate max-w-[72px]" title={s.name}>{s.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixPagination.paginatedItems.map((r) => {
                  const rSkills = resourceSkills[r.id] ?? [];
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="sticky left-0 bg-background p-3 cursor-pointer hover:bg-muted/50" onClick={() => onOpenProfile(r)}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{getInitials(r.firstName, r.lastName)}</AvatarFallback></Avatar>
                          <span className="text-sm">{r.firstName} {r.lastName}</span>
                        </div>
                      </td>
                      {skills.map((s) => {
                        const match = rSkills.find((rs) => rs.skillId === s.id);
                        const prof = match ? getProficiencyConfig(match.skillLevel ?? match.proficiencyLevel) : null;
                        return (
                          <td key={s.id} className="p-2 text-center">
                            {prof ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className={cn("w-7 h-7 mx-auto rounded-full flex items-center justify-center text-[10px] font-bold", prof.color)}>{prof.level}</div>
                                </TooltipTrigger>
                                <TooltipContent>{prof.label}</TooltipContent>
                              </Tooltip>
                            ) : <div className="w-7 h-7 mx-auto rounded-full bg-muted/50" />}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination
              page={matrixPagination.page}
              totalPages={matrixPagination.totalPages}
              total={matrixPagination.total}
              startIndex={matrixPagination.startIndex}
              endIndex={matrixPagination.endIndex}
              pageSize={matrixPagination.pageSize}
              onPageChange={matrixPagination.setPage}
              onPageSizeChange={matrixPagination.setPageSize}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {searchCriteria.map((c, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs">Skill</Label>
                <Select value={c.skillId} onValueChange={(v) => {
                  const next = [...searchCriteria];
                  next[i] = { ...next[i], skillId: v };
                  setSearchCriteria(next);
                }}>
                  <SelectTrigger><SelectValue placeholder="Skill" /></SelectTrigger>
                  <SelectContent>
                    {skills.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label className="text-xs">Min level</Label>
                <Select value={c.minLevel} onValueChange={(v) => { const next = [...searchCriteria]; next[i].minLevel = v; setSearchCriteria(next); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROFICIENCY_LEVELS.map((p) => <SelectItem key={p.level} value={String(p.level)}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input className="w-24" type="number" placeholder="Yrs" value={c.minYears} onChange={(e) => { const next = [...searchCriteria]; next[i].minYears = e.target.value; setSearchCriteria(next); }} />
            </div>
          ))}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={searchLogic === "or"} onCheckedChange={(v) => setSearchLogic(v ? "or" : "and")} /> OR logic
            </label>
            <Button onClick={runSearch} disabled={searchLoading}>
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Search
            </Button>
            {searchResults.length > 0 && (
              <Button variant="outline" onClick={exportSearchCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            )}
          </div>
          <div className="space-y-2">
            {searchPagination.paginatedItems.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.firstName} {r.lastName}</p>
                    <p className="text-sm text-muted-foreground">{r.jobTitle} · {r.utilisationPct}% allocated</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {r.matchingSkills.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s.name} L{s.level}</Badge>)}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onOpenProfile(r)}>View profile</Button>
                </CardContent>
              </Card>
            ))}
            {searchResults.length > 0 && (
              <TablePagination
                page={searchPagination.page}
                totalPages={searchPagination.totalPages}
                total={searchPagination.total}
                startIndex={searchPagination.startIndex}
                endIndex={searchPagination.endIndex}
                pageSize={searchPagination.pageSize}
                onPageChange={searchPagination.setPage}
                onPageSizeChange={searchPagination.setPageSize}
              />
            )}
          </div>
        </div>
      )}

      <Dialog open={showAdmin} onOpenChange={setShowAdmin}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Skills</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} /></div>
            <div>
              <Label>Category</Label>
              <Select value={newSkillCategory} onValueChange={setNewSkillCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={isCertification} onCheckedChange={(v) => setIsCertification(!!v)} /> Certification skill</label>
          </div>
          <DialogFooter>
            <Button onClick={() => createSkillMutation.mutate({ name: newSkillName, categoryId: newSkillCategory ? Number(newSkillCategory) : null, isCertification })} disabled={!newSkillName}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGap} onOpenChange={setShowGap}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Skills Gap Analysis</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Resource plan ID" value={gapPlanId} onChange={(e) => setGapPlanId(e.target.value)} />
            <Button onClick={runGap} disabled={gapLoading || !gapPlanId}>
              {gapLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Analyse
            </Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {gapResults.map((g, i) => (
              <div key={i} className="p-2 border rounded text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{g.role}</span>
                  <Badge variant={g.coverage === "full" ? "default" : g.coverage === "partial" ? "secondary" : "destructive"}>{g.coverage}</Badge>
                </div>
                <p className="text-muted-foreground">{g.qualifiedCount} qualified · {g.candidates.join(", ") || "None"}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
