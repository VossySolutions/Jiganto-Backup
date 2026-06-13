import { useState, useEffect } from "react";
import { Hash, Lock, Megaphone, MessageSquare, Search, BarChart2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUserInitials } from "@/lib/chat-utils";
import { ChatButtonSpinner, ChatSpinner } from "@/components/chat/ChatLoading";
import { SubmitForm } from "@/components/ui/submit-form";
import type { Project } from "@shared/models/chat";

type SearchUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
};

export function NewChatDialog({
  open,
  onOpenChange,
  searchUsers,
  userSearchQuery,
  onSearchChange,
  onSelectUser,
  currentUserId,
  isSearching,
  isStarting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  searchUsers: SearchUser[];
  userSearchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectUser: (userId: string) => void;
  currentUserId?: string;
  isSearching?: boolean;
  isStarting?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>Search for a person to message.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users…"
            value={userSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="space-y-1 pt-2">
            {isStarting && (
              <ChatSpinner label="Starting conversation…" className="py-6" />
            )}
            {!isStarting && isSearching && userSearchQuery.length >= 2 && (
              <ChatSpinner label="Searching…" className="py-6" />
            )}
            {!isStarting && !isSearching &&
              searchUsers
              .filter((u) => u.id !== currentUserId)
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 text-left"
                  onClick={() => onSelectUser(u.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={u.profileImageUrl || undefined} />
                    <AvatarFallback>{getUserInitials(u.firstName, u.lastName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <MessageSquare className="h-4 w-4 ml-auto text-muted-foreground" />
                </button>
              ))}
            {!isStarting && !isSearching && userSearchQuery.length >= 2 && searchUsers.filter((u) => u.id !== currentUserId).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
            )}
            {userSearchQuery.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-6">Type at least 2 characters</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  projects,
  onCreate,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: Project[];
  onCreate: (data: { name: string; type: string; projectId?: number }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("public");
  const [projectId, setProjectId] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim().replace(/^#/, ""),
      type,
      projectId: projectId && projectId !== "none" ? Number(projectId) : undefined,
    });
    setName("");
    setType("public");
    setProjectId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create channel</DialogTitle>
          <DialogDescription>Add a new channel to a team or company.</DialogDescription>
        </DialogHeader>
        <SubmitForm onSubmit={submit} className="space-y-4" disabled={!name.trim() || pending}>
          <div>
            <Label>Channel name</Label>
            <Input
              placeholder="general"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Type</Label>
            <RadioGroup value={type} onValueChange={setType} className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="public" id="ch-public" />
                <Label htmlFor="ch-public" className="flex items-center gap-2 font-normal">
                  <Hash className="h-4 w-4" /> Public
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="private" id="ch-private" />
                <Label htmlFor="ch-private" className="flex items-center gap-2 font-normal">
                  <Lock className="h-4 w-4" /> Private
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="announcement" id="ch-announcement" />
                <Label htmlFor="ch-announcement" className="flex items-center gap-2 font-normal">
                  <Megaphone className="h-4 w-4" /> Announcement (admins only)
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label>Team (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Company-wide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Company-wide</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim() || pending}>
            {pending ? <ChatButtonSpinner /> : null}
            {pending ? "Creating channel…" : "Create channel"}
          </Button>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (data: { name: string; description?: string; isPrivate?: boolean }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim() || undefined, isPrivate });
    setName("");
    setDescription("");
    setIsPrivate(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>Creates a team with a default #general channel.</DialogDescription>
        </DialogHeader>
        <SubmitForm onSubmit={submit} className="space-y-4" disabled={!name.trim() || pending}>
          <div>
            <Label>Team name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            Private team
          </label>
          <Button type="submit" className="w-full" disabled={!name.trim() || pending}>
            {pending ? <ChatButtonSpinner /> : null}
            {pending ? "Creating team…" : "Create team"}
          </Button>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

export function PollCreatorDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: { question: string; options: string[]; durationMinutes: number; anonymous: boolean }) => void;
  pending: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("1440");
  const [anonymous, setAnonymous] = useState(false);

  const submit = () => {
    const valid = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || valid.length < 2) return;
    onSubmit({ question: question.trim(), options: valid, durationMinutes: Number(duration), anonymous });
    setQuestion("");
    setOptions(["", ""]);
    setDuration("1440");
    setAnonymous(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-indigo-500" /> Create poll
          </DialogTitle>
        </DialogHeader>
        <SubmitForm onSubmit={submit} className="space-y-4" disabled={pending}>
          <Input placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
              />
              {options.length > 2 && (
                <Button type="button" size="icon" variant="ghost" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOptions([...options, ""])}>
              + Add option
            </Button>
          )}
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="1440">24 hours</SelectItem>
              <SelectItem value="10080">1 week</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Anonymous votes
          </label>
          <Button type="submit" className="w-full gap-2" disabled={pending}>
            {pending ? <ChatButtonSpinner /> : <Check className="h-4 w-4" />}
            {pending ? "Posting poll…" : "Post poll"}
          </Button>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

export function RenameTeamDialog({
  open,
  onOpenChange,
  teamName,
  onRename,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamName: string;
  onRename: (name: string) => void;
  pending?: boolean;
}) {
  const [name, setName] = useState(teamName);

  useEffect(() => {
    if (open) setName(teamName);
  }, [open, teamName]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setName(teamName);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename team</DialogTitle>
          <DialogDescription>
            Update the team folder name shown in Teams &amp; Channels (e.g. Finance Dept.).
          </DialogDescription>
        </DialogHeader>
        <SubmitForm
          onSubmit={() => {
            const trimmed = name.trim();
            if (trimmed) onRename(trimmed);
          }}
          className="space-y-4"
          disabled={pending || !name.trim()}
        >
          <div className="space-y-2">
            <Label htmlFor="team-rename">Team name</Label>
            <Input
              id="team-rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Finance Dept."
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
            {pending ? <ChatButtonSpinner /> : "Save"}
          </Button>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}
