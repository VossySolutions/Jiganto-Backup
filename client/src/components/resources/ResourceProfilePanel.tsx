import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, XCircle, Star, Plus, Trash2, AlertTriangle, FileText, Link2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getInitials, getProficiencyConfig, statusColors, PROFICIENCY_LEVELS } from "./constants";
import { ResourcesTabLoading, ResourcesErrorState } from "./ResourcesUi";
import type { Resource, Skill, ResourceSkill } from "@shared/models/resources";

type ProfileDocument = {
  id: number;
  documentId: number;
  title: string;
  linkType: string | null;
  notes: string | null;
};

type ProfileData = {
  resource: Resource;
  skills: ResourceSkill[];
  allocations: Array<{ id: number; projectName: string | null; startDate: string; endDate: string; allocationType: string | null; role: string | null }>;
  timesheets: Array<{ id: number; weekStartDate: string; status: string | null; approvalStatus: string | null; totalHours: string | null }>;
  leaves: Array<{ id: number; leaveType: string | null; startDate: string; endDate: string }>;
  documents?: ProfileDocument[];
};

type Props = {
  resource: Resource;
  skills: Skill[];
  resourceSkills: ResourceSkill[];
  onClose: () => void;
  onAddSkill: (data: { resourceId: number; skillId: number; proficiencyLevel: string; skillLevel: number }) => void;
  onRemoveSkill: (id: number) => void;
  onEdit?: () => void;
};

export function ResourceProfilePanel({ resource, skills, resourceSkills, onClose, onAddSkill, onRemoveSkill, onEdit }: Props) {
  const { toast } = useToast();
  const [newSkillId, setNewSkillId] = useState("");
  const [newLevel, setNewLevel] = useState("3");
  const [linkDocId, setLinkDocId] = useState("");
  const [linkType, setLinkType] = useState("general");
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const { data: profile, isLoading, isError, refetch } = useQuery<ProfileData>({
    queryKey: [`/api/resources/${resource.id}/profile`],
  });

  const { data: allDocuments = [] } = useQuery<Array<{ id: number; title: string }>>({
    queryKey: ["/api/documents"],
    enabled: showLinkDialog,
  });

  const linkDocMutation = useMutation({
    mutationFn: (data: { documentId: number; linkType: string }) =>
      apiRequest("POST", `/api/resources/${resource.id}/documents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resource.id}/profile`] });
      toast({ title: "Document linked" });
      setShowLinkDialog(false);
      setLinkDocId("");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => apiRequest("DELETE", `/api/resources/documents/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resource.id}/profile`] });
      toast({ title: "Document unlinked" });
    },
  });

  const contractEnding = resource.endDate && resource.personType === "contractor"
    ? (new Date(resource.endDate).getTime() - Date.now()) / 86400000
    : null;

  const availableSkills = skills.filter((s) => !resourceSkills.some((rs) => rs.skillId === s.id));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[min(520px,100vw)] bg-background border-l shadow-xl z-50 flex flex-col" data-testid="resource-profile-panel">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b gap-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base truncate"><Users className="h-4 w-4 shrink-0" /> Resource Profile</h3>
        <div className="flex gap-2">
          {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>}
          <Button variant="ghost" size="icon" onClick={onClose}><XCircle className="h-4 w-4" /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={resource.photoUrl ?? undefined} />
              <AvatarFallback className="text-xl">{getInitials(resource.firstName, resource.lastName)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{resource.firstName} {resource.lastName}</h2>
              <p className="text-sm text-muted-foreground">{resource.jobTitle ?? "No title"}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Badge className={cn("text-xs", statusColors[resource.status ?? "active"])}>{resource.status ?? "active"}</Badge>
                {resource.personType && <Badge variant="outline" className="text-xs capitalize">{resource.personType}</Badge>}
                {contractEnding != null && contractEnding <= 30 && contractEnding > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Contract ends in {Math.ceil(contractEnding)}d</Badge>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="w-full overflow-x-auto flex-nowrap">
              <TabsTrigger value="overview" className="flex-1 min-w-[4.5rem] text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="skills" className="flex-1 min-w-[4rem] text-xs sm:text-sm">Skills</TabsTrigger>
              <TabsTrigger value="allocations" className="flex-1 min-w-[5rem] text-xs sm:text-sm">Allocations</TabsTrigger>
              <TabsTrigger value="timesheets" className="flex-1 min-w-[5rem] text-xs sm:text-sm">Timesheets</TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 min-w-[5rem] text-xs sm:text-sm">Documents</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1 min-w-[4rem] text-xs sm:text-sm">Notes</TabsTrigger>
            </TabsList>

            {isLoading && <ResourcesTabLoading label="Loading profile..." />}

            {isError && <ResourcesErrorState message="Could not load profile details" onRetry={() => refetch()} />}

            {!isLoading && !isError && (
            <>

            <TabsContent value="overview" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Email</p><p>{resource.email ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Department</p><p>{resource.department ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Location</p><p>{resource.location ?? "—"}</p></div>
                <div><p className="text-muted-foreground">FTE</p><p>{resource.fte ?? "1.0"}</p></div>
                <div><p className="text-muted-foreground">Charge rate</p><p>{resource.billRate ? `£${resource.billRate}/day` : "—"}</p></div>
                <div><p className="text-muted-foreground">Cost rate</p><p>{resource.costRate ? `£${resource.costRate}/day` : "—"}</p></div>
                <div><p className="text-muted-foreground">Right to work</p><p className="capitalize">{resource.rightToWorkStatus ?? "incomplete"}</p></div>
                <div><p className="text-muted-foreground">Jiganto user</p><p>{resource.userId ? "Yes" : "No"}</p></div>
              </div>
              {(profile?.allocations?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Current allocations</p>
                  {profile!.allocations.slice(0, 3).map((a) => (
                    <div key={a.id} className="text-sm p-2 rounded bg-muted/40 mb-1">{a.projectName} · {a.role}</div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="skills" className="mt-4 space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Skill</Label>
                  <Select value={newSkillId} onValueChange={setNewSkillId}>
                    <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
                    <SelectContent>
                      {availableSkills.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Label className="text-xs">Level</Label>
                  <Select value={newLevel} onValueChange={setNewLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROFICIENCY_LEVELS.map((p) => <SelectItem key={p.level} value={String(p.level)}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" disabled={!newSkillId} onClick={() => {
                  const lvl = PROFICIENCY_LEVELS.find((p) => p.level === Number(newLevel));
                  onAddSkill({ resourceId: resource.id, skillId: Number(newSkillId), proficiencyLevel: lvl?.value ?? "practitioner", skillLevel: Number(newLevel) });
                  setNewSkillId("");
                }}><Plus className="h-4 w-4" /></Button>
              </div>
              {resourceSkills.map((rs) => {
                const skill = skills.find((s) => s.id === rs.skillId);
                const prof = getProficiencyConfig(rs.skillLevel ?? rs.proficiencyLevel);
                return (
                  <div key={rs.id} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{skill?.name}</span>
                      <Badge className={cn("text-xs", prof.color)}>{prof.label}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onRemoveSkill(rs.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="allocations" className="mt-4 space-y-2">
              {(profile?.allocations ?? []).map((a) => (
                <div key={a.id} className="p-3 rounded border text-sm">
                  <p className="font-medium">{a.projectName ?? "Project"}</p>
                  <p className="text-muted-foreground">{new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}</p>
                  <Badge variant="outline" className="mt-1 text-xs capitalize">{a.allocationType ?? "confirmed"}</Badge>
                </div>
              ))}
              {!profile?.allocations?.length && <p className="text-sm text-muted-foreground">No allocations</p>}
            </TabsContent>

            <TabsContent value="timesheets" className="mt-4 space-y-2">
              {(profile?.timesheets ?? []).map((t) => (
                <div key={t.id} className="flex justify-between p-2 rounded border text-sm">
                  <span>{new Date(t.weekStartDate).toLocaleDateString()}</span>
                  <Badge variant="outline">{t.approvalStatus ?? t.status}</Badge>
                  <span>{t.totalHours ?? 0}h</span>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="documents" className="mt-4 space-y-2">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">Linked documents</p>
                <Button size="sm" variant="outline" onClick={() => setShowLinkDialog(true)}>
                  <Link2 className="h-4 w-4 mr-1" /> Link
                </Button>
              </div>
              {(profile?.documents ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents linked</p>
              ) : (profile?.documents ?? []).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-orange-500" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.title}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{doc.linkType ?? "general"}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`/modules/documents?document=${doc.documentId}`}><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => unlinkMutation.mutate(doc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <p className="text-sm whitespace-pre-wrap">{resource.internalNotes || resource.notes || "No internal notes"}</p>
            </TabsContent>
            </>
            )}
          </Tabs>
        </div>
      </ScrollArea>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Document</Label>
              <Select value={linkDocId} onValueChange={setLinkDocId}>
                <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
                <SelectContent>
                  {allDocuments.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Link type</Label>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["general", "contract", "cv", "certification", "sow"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
            <Button disabled={!linkDocId} onClick={() => linkDocMutation.mutate({ documentId: Number(linkDocId), linkType })}>Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
