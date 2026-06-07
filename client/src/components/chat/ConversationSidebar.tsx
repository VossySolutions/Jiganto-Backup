import { useState } from "react";
import { ChevronDown, ChevronRight, Hash, Link2, Lock, Megaphone, MessageSquare, Plus, Search, Star, StarOff, User, Building2, FolderKanban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatInboxItem } from "@shared/models/chat";
import { formatListTimestamp, getUserInitials, loadCollapsedTeams, saveCollapsedTeams, type ChatSectionState } from "@/lib/chat-utils";
import { ChatSidebarSkeleton } from "@/components/chat/ChatLoading";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#4338CA] text-white text-[10px] font-semibold flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ChannelIcon({ type, bridged }: { type: string; bridged?: boolean }) {
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
        "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors cursor-pointer group",
        selected ? "bg-[#4338CA]/10 text-[#4338CA]" : "hover:bg-muted/60 text-foreground/90",
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
        <div className="flex items-baseline gap-1">
          <span className="truncate text-sm font-medium leading-none">{item.displayName}</span>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-auto leading-none">
            {formatListTimestamp(item.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {item.lastMessagePreview && (
            <p className="text-xs text-muted-foreground truncate flex-1">{item.lastMessagePreview}</p>
          )}
          <UnreadBadge count={item.unreadCount} />
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
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
        className="flex items-center gap-2 flex-1 text-xs font-semibold text-foreground/80 uppercase tracking-wide hover:bg-muted/50 rounded-lg px-1 py-1"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {label}
        {!expanded && unreadTotal > 0 && (
          <Badge className="h-5 text-[10px] bg-[#4338CA]/15 text-[#4338CA] border-0">{unreadTotal}</Badge>
        )}
        {expanded && (
          <Badge variant="secondary" className="ml-auto h-5 text-[10px]">
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
  inboxLoading,
  favoritingChannelId,
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
  inboxLoading?: boolean;
  favoritingChannelId?: number | null;
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
  const projectGroups = channels.reduce<Record<string, ChatInboxItem[]>>((acc, ch) => {
    if (!ch.projectId) return acc;
    const key = ch.projectName ?? `Project ${ch.projectId}`;
    acc[key] = acc[key] ?? [];
    acc[key].push(ch);
    return acc;
  }, {});

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
    <div className="w-80 border-r bg-card flex flex-col shrink-0" data-testid="channel-sidebar">
      <div className="h-14 border-b flex items-center px-4 justify-between">
        <h2 className="font-semibold text-sm">Conversations</h2>
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
      <ScrollArea className="flex-1">
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
              <div className="mt-1">
                {favourites.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2">Star a channel or chat to pin it here.</p>
                ) : (
                  renderList(favourites)
                )}
              </div>
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
              <div className="mt-1">
                {chats.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2">No chats yet.</p>
                ) : (
                  renderList(chats)
                )}
              </div>
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
              <div className="mt-1 space-y-1">
                {companyChannels.length > 0 && (
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground px-2 py-1 w-full hover:text-foreground rounded"
                      onClick={() => toggleTeam("__company__")}
                    >
                      {collapsedTeams.has("__company__") ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      <Building2 className="h-3 w-3" /> Company
                      {collapsedTeams.has("__company__") && companyChannels.reduce((s, i) => s + i.unreadCount, 0) > 0 && (
                        <Badge className="ml-auto h-4 text-[9px] bg-[#4338CA]/15 text-[#4338CA] border-0">
                          {companyChannels.reduce((s, i) => s + i.unreadCount, 0)}
                        </Badge>
                      )}
                    </button>
                    {!collapsedTeams.has("__company__") && renderList(companyChannels)}
                  </div>
                )}
                {Object.entries(projectGroups).map(([teamName, items]) => {
                  const teamUnread = items.reduce((s, i) => s + i.unreadCount, 0);
                  const isCollapsed = collapsedTeams.has(teamName);
                  return (
                    <div key={teamName}>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground px-2 py-1 w-full hover:text-foreground rounded"
                        onClick={() => toggleTeam(teamName)}
                      >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <FolderKanban className="h-3 w-3" />
                        <span className="truncate">{teamName}</span>
                        {isCollapsed && teamUnread > 0 && (
                          <Badge className="ml-auto h-4 text-[9px] bg-[#4338CA]/15 text-[#4338CA] border-0 shrink-0">{teamUnread}</Badge>
                        )}
                      </button>
                      {!isCollapsed && renderList(items)}
                    </div>
                  );
                })}
                {channels.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-2">No channels yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </ScrollArea>
    </div>
  );
}
