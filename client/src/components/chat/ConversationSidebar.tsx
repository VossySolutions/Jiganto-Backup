import { useState } from "react";
import { ChevronDown, ChevronRight, Hash, Link2, Lock, Megaphone, MessageSquare, MoreHorizontal, Plus, Pencil, Search, Star, StarOff, User, Building2, FolderKanban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ChatInboxItem } from "@shared/models/chat";
import { formatListTimestamp, getUserInitials, loadCollapsedTeams, saveCollapsedTeams, chatFont, type ChatSectionState } from "@/lib/chat-utils";
import { ChatSidebarSkeleton } from "@/components/chat/ChatLoading";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className={cn("ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-indigo-500 text-white flex items-center justify-center", chatFont.badge)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ChannelIcon({ type }: { type: string; bridged?: boolean }) {
  if (type === "private") return <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  if (type === "direct") return <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  if (type === "announcement") return <Megaphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  return <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

function ConversationRow({
  item,
  selected,
  online,
  onSelect,
  onToggleFavorite,
  favoriting,
}: {
  item: ChatInboxItem;
  selected: boolean;
  online?: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  favoriting?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer group",
        selected ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" : "hover:bg-muted/60 text-foreground/90",
        item.unreadCount > 0 && !selected && "font-medium",
      )}
      data-testid={`conversation-${item.channelId}`}
    >
      {item.type === "direct" && item.otherUser ? (
        <div className="relative shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={item.otherUser.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">
              {getUserInitials(item.otherUser.firstName, item.otherUser.lastName)}
            </AvatarFallback>
          </Avatar>
          {online !== undefined && (
            <span
              className={cn(
                "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                online ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
          )}
        </div>
      ) : (
        <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 relative">
          <ChannelIcon type={item.type} />
          {item.bridge?.active && (
            <Link2 className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-emerald-600" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={cn("truncate", chatFont.channelName, selected && "font-semibold")}>{item.displayName}</span>
          <span className={cn("shrink-0 ml-auto", chatFont.channelMeta)}>
            {formatListTimestamp(item.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {item.lastMessagePreview && (
            <p className={cn("truncate flex-1", chatFont.channelPreview)}>{item.lastMessagePreview}</p>
          )}
          <UnreadBadge count={item.unreadCount} />
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 sm:h-6 sm:w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
        disabled={favoriting}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        {item.isFavorite ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function TeamFolderRow({
  name,
  icon,
  unread,
  collapsed,
  onToggle,
  onRename,
  labelClass,
}: {
  name: string;
  icon: React.ReactNode;
  unread: number;
  collapsed: boolean;
  onToggle: () => void;
  onRename?: () => void;
  labelClass: string;
}) {
  return (
    <div className="group flex items-center gap-0.5 rounded-lg hover:bg-muted/40">
      <button
        type="button"
        className={cn("flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5 rounded-lg hover:text-foreground hover:bg-muted/30", labelClass)}
        onClick={onToggle}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {icon}
        <span className="truncate">{name}</span>
        {collapsed && unread > 0 && (
          <Badge className={cn("ml-auto h-5 bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 border-0 shrink-0", chatFont.badge)}>
            {unread}
          </Badge>
        )}
      </button>
      {onRename && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              title="Team options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function TreeBranch({ children, nested }: { children: React.ReactNode; nested?: boolean }) {
  return (
    <div
      className={cn(
        "space-y-0.5 border-l border-border/50",
        nested ? "ml-2 pl-3" : "ml-3 pl-3",
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  label,
  icon,
  expanded,
  unreadTotal,
  count,
  onToggle,
  action,
}: {
  label: string;
  icon: React.ReactNode;
  expanded: boolean;
  unreadTotal: number;
  count: number;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn("flex items-center gap-2 flex-1 hover:bg-muted/50 rounded-lg px-1.5 py-1.5", chatFont.sectionHeader)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
        {!expanded && unreadTotal > 0 && (
          <Badge className={cn("h-5 bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 border-0", chatFont.badge)}>{unreadTotal}</Badge>
        )}
        {expanded && count > 0 && (
          <Badge variant="secondary" className={cn("ml-auto h-5", chatFont.badge)}>
            {count}
          </Badge>
        )}
      </button>
      {action}
    </div>
  );
}

export function ConversationSidebar({
  inbox,
  selectedChannelId,
  searchQuery,
  sections,
  onlineUsers,
  onSearchChange,
  onSelectChannel,
  onToggleSection,
  onToggleFavorite,
  onNewChat,
  onCreateChannel,
  onCreateTeam,
  onRenameTeam,
  inboxLoading,
  favoritingChannelId,
  className,
}: {
  inbox: ChatInboxItem[];
  selectedChannelId: number | null;
  searchQuery: string;
  sections: ChatSectionState;
  onlineUsers: Set<string>;
  onSearchChange: (q: string) => void;
  onSelectChannel: (id: number) => void;
  onToggleSection: (key: keyof ChatSectionState) => void;
  onToggleFavorite: (channelId: number, isFavorite: boolean) => void;
  onNewChat: () => void;
  onCreateChannel: () => void;
  onCreateTeam?: () => void;
  onRenameTeam?: (projectId: number, currentName: string) => void;
  inboxLoading?: boolean;
  favoritingChannelId?: number | null;
  className?: string;
}) {
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(loadCollapsedTeams);

  const toggleTeam = (teamName: string) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamName)) next.delete(teamName);
      else next.add(teamName);
      saveCollapsedTeams(next);
      return next;
    });
  };

  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? inbox.filter(
        (i) =>
          i.displayName.toLowerCase().includes(q) ||
          i.lastMessagePreview?.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q),
      )
    : inbox;

  const favourites = filtered.filter((i) => i.isFavorite);
  const chats = filtered.filter((i) => i.type === "direct");
  const channels = filtered.filter((i) => i.type !== "direct");
  const companyChannels = channels.filter((c) => !c.projectId);
  const projectGroups = channels.reduce<Array<{ projectId: number; name: string; items: ChatInboxItem[] }>>(
    (acc, ch) => {
      if (!ch.projectId) return acc;
      const existing = acc.find((g) => g.projectId === ch.projectId);
      const name = ch.projectName ?? `Project ${ch.projectId}`;
      if (existing) {
        existing.items.push(ch);
      } else {
        acc.push({ projectId: ch.projectId, name, items: [ch] });
      }
      return acc;
    },
    [],
  );

  const favUnread = favourites.reduce((s, i) => s + i.unreadCount, 0);
  const chatUnread = chats.reduce((s, i) => s + i.unreadCount, 0);
  const channelUnread = channels.reduce((s, i) => s + i.unreadCount, 0);

  const renderList = (items: ChatInboxItem[]) =>
    items.map((item) => (
      <ConversationRow
        key={item.channelId}
        item={item}
        selected={selectedChannelId === item.channelId}
        online={item.otherUser ? onlineUsers.has(item.otherUser.id) : undefined}
        onSelect={() => onSelectChannel(item.channelId)}
        onToggleFavorite={() => onToggleFavorite(item.channelId, item.isFavorite)}
        favoriting={favoritingChannelId === item.channelId}
      />
    ));

  return (
    <div
      className={cn(
        "w-full md:w-72 lg:w-80 border-r bg-card flex flex-col shrink-0 min-h-0",
        className,
      )}
      data-testid="channel-sidebar"
    >
      <div className="h-14 border-b flex items-center px-4 justify-between">
        <h2 className={chatFont.sidebarTitle}>Conversations</h2>
        <Button size="icon" variant="ghost" onClick={onCreateChannel}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {inboxLoading ? (
          <ChatSidebarSkeleton />
        ) : (
        <div className="p-2 space-y-3">
          <div>
            <SectionHeader
              label="Favourites"
              icon={<Star className="h-3 w-3 text-amber-500" />}
              expanded={sections.favourites}
              unreadTotal={favUnread}
              count={favourites.length}
              onToggle={() => onToggleSection("favourites")}
            />
            {sections.favourites && (
              <TreeBranch>
                {favourites.length === 0 ? (
                  <p className={cn("px-1 py-1", chatFont.emptyHint)}>Star a channel or chat to pin it here.</p>
                ) : (
                  renderList(favourites)
                )}
              </TreeBranch>
            )}
          </div>
          <div>
            <SectionHeader
              label="Chats"
              icon={<MessageSquare className="h-3 w-3 text-blue-500" />}
              expanded={sections.chats}
              unreadTotal={chatUnread}
              count={chats.length}
              onToggle={() => onToggleSection("chats")}
              action={
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onNewChat}>
                  <Plus className="h-3 w-3" />
                </Button>
              }
            />
            {sections.chats && (
              <TreeBranch>
                {chats.length === 0 ? (
                  <p className={cn("px-1 py-1", chatFont.emptyHint)}>No chats yet.</p>
                ) : (
                  renderList(chats)
                )}
              </TreeBranch>
            )}
          </div>
          <div>
            <SectionHeader
              label="Teams & Channels"
              icon={<Building2 className="h-3 w-3 text-purple-500" />}
              expanded={sections.channels}
              unreadTotal={channelUnread}
              count={channels.length}
              onToggle={() => onToggleSection("channels")}
              action={
                onCreateTeam && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCreateTeam} title="New Team">
                    <Plus className="h-3 w-3" />
                  </Button>
                )
              }
            />
            {sections.channels && (
              <TreeBranch>
                {companyChannels.length > 0 && (
                  <div>
                    <TeamFolderRow
                      name="Company"
                      icon={<Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      labelClass={chatFont.companyGroup}
                      unread={companyChannels.reduce((s, i) => s + i.unreadCount, 0)}
                      collapsed={collapsedTeams.has("__company__")}
                      onToggle={() => toggleTeam("__company__")}
                    />
                    {!collapsedTeams.has("__company__") && (
                      <TreeBranch nested>
                        {renderList(companyChannels)}
                      </TreeBranch>
                    )}
                  </div>
                )}
                {projectGroups.map(({ projectId, name, items }) => {
                  const teamUnread = items.reduce((s, i) => s + i.unreadCount, 0);
                  const isCollapsed = collapsedTeams.has(name);
                  return (
                    <div key={projectId}>
                      <TeamFolderRow
                        name={name}
                        icon={<FolderKanban className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        labelClass={chatFont.teamFolder}
                        unread={teamUnread}
                        collapsed={isCollapsed}
                        onToggle={() => toggleTeam(name)}
                        onRename={
                          onRenameTeam
                            ? () => onRenameTeam(projectId, name)
                            : undefined
                        }
                      />
                      {!isCollapsed && (
                        <TreeBranch nested>
                          {renderList(items)}
                        </TreeBranch>
                      )}
                    </div>
                  );
                })}
                {channels.length === 0 && (
                  <p className={cn("px-1 py-1", chatFont.emptyHint)}>No channels yet.</p>
                )}
              </TreeBranch>
            )}
          </div>
        </div>
        )}
      </ScrollArea>
    </div>
  );
}
