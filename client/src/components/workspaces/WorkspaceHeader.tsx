import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  MoreHorizontal,
  PanelLeft,
  Share2,
  Star,
  Copy,
  Archive,
  LayoutTemplate,
  Trash2,
} from "lucide-react";
import { WorkspacePresenceAvatars } from "@/components/workspaces/WorkspacePresence";

import type { Workspace } from "@shared/schema";

interface WorkspaceMemberPreview {
  id: number;
  userId: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
}

export function WorkspaceHeader({
  workspace,
  members = [],
  workspaceId,
  currentPageId,
  readOnly = false,
  onBack,
  onShare,
  onToggleFavorite,
  onToggleSidebar,
  onUpdateWorkspace,
  onDuplicate,
  onArchive,
  onSaveAsTemplate,
  onDelete,
}: {
  workspace: Workspace;
  members?: WorkspaceMemberPreview[];
  workspaceId?: number;
  currentPageId?: number | null;
  readOnly?: boolean;
  onBack?: () => void;
  onShare?: () => void;
  onToggleFavorite?: () => void;
  onToggleSidebar?: () => void;
  onUpdateWorkspace?: (updates: { name?: string; description?: string; color?: string }) => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onSaveAsTemplate?: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(workspace.name || "");
  const [description, setDescription] = useState(workspace.description || "");

  useEffect(() => {
    setName(workspace.name || "");
    setDescription(workspace.description || "");
  }, [workspace.description, workspace.name]);

  const accent = workspace.color || "#7C3AED";

  return (
    <header className="border-b bg-background" data-testid="workspace-header">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onBack} data-testid="workspace-header-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !readOnly && name.trim() !== (workspace.name || "") && onUpdateWorkspace?.({ name: name.trim() })}
              className="h-9 min-w-0 flex-1 sm:max-w-[460px] border-transparent px-2 text-base sm:text-lg font-semibold shadow-none hover:bg-muted/40 focus-visible:border-input"
              disabled={readOnly}
              data-testid="workspace-header-name"
            />
            <Badge variant="secondary" className="hidden sm:inline-flex shrink-0">
              Workspace
            </Badge>
          </div>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              !readOnly &&
              description.trim() !== (workspace.description || "") &&
              onUpdateWorkspace?.({ description: description.trim() })
            }
            placeholder="Add workspace description..."
            className="h-8 border-transparent px-2 text-sm text-muted-foreground shadow-none hover:bg-muted/40 focus-visible:border-input"
            disabled={readOnly}
            data-testid="workspace-header-description"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
          {workspaceId ? (
            <WorkspacePresenceAvatars workspaceId={workspaceId} currentPageId={currentPageId} className="mr-1 hidden md:flex" />
          ) : null}
          <div className="mr-1 hidden items-center -space-x-2 md:flex">
            {members.slice(0, 4).map((member, index) => {
              const label =
                [member.user?.firstName, member.user?.lastName].filter(Boolean).join(" ") ||
                member.user?.email ||
                member.userId ||
                "?";
              return (
              <button
                key={member.id}
                onClick={onShare}
                className="rounded-full border-2 border-background"
                style={{ zIndex: members.length - index }}
                data-testid={`workspace-header-member-${member.id}`}
                title={label}
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">
                    {label.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            );})}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFavorite}
            data-testid="workspace-header-favorite"
          >
            <Star className={cn("h-4 w-4", workspace.isFavorite && "fill-amber-400 text-amber-400")} />
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={onShare} data-testid="workspace-header-share">
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleSidebar}
            data-testid="workspace-header-sidebar-toggle"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="workspace-header-menu">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate} className="gap-2">
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive} className="gap-2">
                <Archive className="h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSaveAsTemplate} className="gap-2">
                <LayoutTemplate className="h-4 w-4" />
                Save as template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
