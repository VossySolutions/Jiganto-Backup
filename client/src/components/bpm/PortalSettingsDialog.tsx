import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings, Plus, Trash2, Loader2 } from "lucide-react";
import type { PortalBusinessAreaColor } from "@shared/models/bpm-extensions";

type Props = {
  libraryId: number | null;
};

const DEFAULT_COLORS = [
  "#1E88C8", "#7C3AED", "#22C55E", "#F59E0B", "#EC4899", "#14B8A6",
  "#EF4444", "#8B5CF6", "#F97316", "#6366F1", "#84CC16", "#0EA5E9",
];

export function PortalSettingsDialog({ libraryId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [accessModel, setAccessModel] = useState("open");
  const [areaColors, setAreaColors] = useState<PortalBusinessAreaColor[]>([]);
  const [userAreaTags, setUserAreaTags] = useState<{ userId: string; areas: string }[]>([]);
  const [newArea, setNewArea] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [newTagUserId, setNewTagUserId] = useState("");
  const [newTagAreas, setNewTagAreas] = useState("");

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/bpm/portal-settings${libraryId ? `?libraryId=${libraryId}` : ""}`],
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("PUT", "/api/bpm/portal-settings", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpm/portal-settings") });
      toast({ title: "Portal settings saved" });
      setOpen(false);
    },
  });

  const handleOpen = () => {
    setOpen(true);
    if (settings) {
      setAccessModel(settings.accessModel || "open");
      const colors = settings.businessAreaColors || {};
      setAreaColors(Object.entries(colors).map(([area, color]) => ({ area, color: color as string })));
      const tags = settings.userAreaTags || {};
      setUserAreaTags(Object.entries(tags).map(([userId, areas]) => ({
        userId,
        areas: Array.isArray(areas) ? areas.join(", ") : String(areas),
      })));
    }
  };

  const addAreaColor = () => {
    if (!newArea.trim()) return;
    setAreaColors(prev => [...prev.filter(a => a.area !== newArea.trim()), { area: newArea.trim(), color: newColor }]);
    setNewArea("");
  };

  const addUserTag = () => {
    if (!newTagUserId.trim() || !newTagAreas.trim()) return;
    setUserAreaTags(prev => [
      ...prev.filter(t => t.userId !== newTagUserId.trim()),
      { userId: newTagUserId.trim(), areas: newTagAreas.trim() },
    ]);
    setNewTagUserId("");
    setNewTagAreas("");
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleOpen} data-testid="button-portal-settings">
        <Settings className="h-4 w-4 mr-1" /> Settings
      </Button>
      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Process Portal Settings"
        saveLabel="Save Settings"
        onCancel={() => setOpen(false)}
        onSubmit={() => saveMutation.mutate({
          libraryId,
          accessModel,
          businessAreaColors: Object.fromEntries(areaColors.map(a => [a.area, a.color])),
          userAreaTags: Object.fromEntries(
            userAreaTags.map(t => [t.userId, t.areas.split(",").map(s => s.trim()).filter(Boolean)]),
          ),
        })}
        saving={saveMutation.isPending}
        testId="dialog-portal-settings"
        saveTestId="button-save-portal-settings"
        size="lg"
      >
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <FormSection title="Access and visibility">
            <div className="space-y-4">
              <div>
                <FieldLabel>Access Control</FieldLabel>
                <Select value={accessModel} onValueChange={setAccessModel}>
                  <SelectTrigger data-testid="select-access-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Model A — Open Access (all members)</SelectItem>
                    <SelectItem value="tag_based">Model B — Tag-based Visibility</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Tag-based: users see only Business Areas matching their tags. Admins and PMs see all.
                </p>
              </div>
              {accessModel === "tag_based" && (
                <div>
                  <FieldLabel>User Area Tags</FieldLabel>
                  <p className="text-xs text-muted-foreground mb-2">Map user IDs to comma-separated Business Area names they can access.</p>
                  <div className="space-y-2 mb-3">
                    {userAreaTags.map(ut => (
                      <div key={ut.userId} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs shrink-0 max-w-[120px] truncate" title={ut.userId}>{ut.userId}</span>
                        <span className="text-muted-foreground flex-1 truncate">{ut.areas}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setUserAreaTags(prev => prev.filter(t => t.userId !== ut.userId))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Input placeholder="User ID" value={newTagUserId} onChange={e => setNewTagUserId(e.target.value)} className="flex-1 min-w-[120px]" data-testid="input-tag-user-id" />
                    <Input placeholder="Areas (comma-separated)" value={newTagAreas} onChange={e => setNewTagAreas(e.target.value)} className="flex-[2] min-w-[160px]" data-testid="input-tag-areas" />
                    <Button size="icon" variant="outline" onClick={addUserTag} data-testid="button-add-user-tag"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
              <Separator />
              <div>
                <FieldLabel>Business Area Colours</FieldLabel>
                <p className="text-xs text-muted-foreground mb-2">Left-border stripe colour per Business Area in hierarchy and breadcrumbs.</p>
                <div className="space-y-2 mb-3">
                  {areaColors.map(ac => (
                    <div key={ac.area} className="flex items-center gap-2">
                      <div className="w-3 h-8 rounded-sm shrink-0" style={{ backgroundColor: ac.color }} />
                      <span className="text-sm flex-1">{ac.area}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAreaColors(prev => prev.filter(a => a.area !== ac.area))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Business Area name" value={newArea} onChange={e => setNewArea(e.target.value)} className="flex-1" />
                  <Input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-12 p-1" />
                  <Button size="icon" variant="outline" onClick={addAreaColor}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} type="button" className="w-5 h-5 rounded-sm border" style={{ backgroundColor: c }} onClick={() => setNewColor(c)} />
                  ))}
                </div>
              </div>
            </div>
            </FormSection>
          )}
      </FormDialogShell>
    </>
  );
}
