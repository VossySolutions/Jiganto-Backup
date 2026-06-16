import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, UserPlus, Hash, Users, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { ModuleHeader } from "@/components/ModuleHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, fetchWithAuth } from "@/lib/queryClient";
import type { ChatInboxItem, ChatMessageWithMeta, Project } from "@shared/models/chat";
import { loadChatSections, saveChatSections, renameCollapsedTeamKey, type ChatSectionState } from "@/lib/chat-utils";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { MessageThread } from "@/components/chat/MessageThread";
import { MessageCompose } from "@/components/chat/MessageCompose";
import { ChatRightPanel, type RightPanelMode } from "@/components/chat/ChatRightPanel";
import { useChatConfig, useChatSupabaseRealtime } from "@/hooks/use-chat-realtime";
import { ChatSpinner } from "@/components/chat/ChatLoading";
import {
  CreateChannelDialog,
  CreateTeamDialog,
  NewChatDialog,
  PollCreatorDialog,
  RenameTeamDialog,
} from "@/components/chat/ChatDialogs";

export function ChatPage() {
  const { mainOffset, mobileTopOffset, isMobile } = useShellLayout();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const tenantId = permissions?.orgId ?? 1;
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/modules/chat/:channelId?");

  const routeChannelId = params?.channelId ? Number(params.channelId) : null;
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(routeChannelId);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [sections, setSections] = useState<ChatSectionState>(loadChatSections);
  const [rightPanel, setRightPanel] = useState<RightPanelMode>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<number, Set<string>>>(new Map());
  const [oldestLoadedId, setOldestLoadedId] = useState<number | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mergedMessages, setMergedMessages] = useState<ChatMessageWithMeta[]>([]);

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [renameTeamTarget, setRenameTeamTarget] = useState<{ projectId: number; name: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearchQuery), 300);
    return () => clearTimeout(t);
  }, [userSearchQuery]);

  useEffect(() => {
    if (routeChannelId) {
      setSelectedChannelId(routeChannelId);
    } else if (isMobile) {
      setSelectedChannelId(null);
    }
  }, [routeChannelId, isMobile]);

  const selectChannel = useCallback((id: number) => {
    setSelectedChannelId(id);
    setRightPanel(null);
    navigate(`/modules/chat/${id}`);
  }, [navigate]);

  const backToConversationList = useCallback(() => {
    setSelectedChannelId(null);
    setRightPanel(null);
    navigate("/modules/chat");
  }, [navigate]);

  const inboxQueryKey = useMemo(
    () => [`/api/chat/inbox?tenantId=${tenantId}`],
    [tenantId],
  );
  const projectsQueryKey = useMemo(
    () => [`/api/chat/projects/user?tenantId=${tenantId}`],
    [tenantId],
  );
  const usersQueryKey = useMemo(
    () => [`/api/chat/users?tenantId=${tenantId}`],
    [tenantId],
  );
  const userSearchQueryKey = useMemo(
    () => [`/api/chat/users/search?tenantId=${tenantId}&q=${debouncedUserSearch}`],
    [tenantId, debouncedUserSearch],
  );
  const messagesKey = useMemo(
    () =>
      selectedChannelId
        ? [`/api/chat/channels/${selectedChannelId}/messages`]
        : ["no-messages"],
    [selectedChannelId],
  );

  const { data: inbox = [], isLoading: inboxLoading } = useQuery<ChatInboxItem[]>({
    queryKey: inboxQueryKey,
    staleTime: 10_000,      // treat inbox as fresh for 10 s → avoids refetch on tab focus
    refetchInterval: 30_000, // background poll every 30 s (was 15 s; realtime covers the rest)
  });

  const { data: chatConfig } = useChatConfig();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: projectsQueryKey,
    staleTime: 120_000, // projects rarely change — keep for 2 minutes
  });

  const { data: tenantUsers = [] } = useQuery<
    { id: string; firstName: string | null; lastName: string | null; email: string | null }[]
  >({
    queryKey: usersQueryKey,
    staleTime: 120_000, // user list rarely changes
  });

  const { data: searchUsers = [], isFetching: searchUsersFetching } = useQuery<
    { id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null }[]
  >({
    queryKey: userSearchQueryKey,
    enabled: isNewChatOpen && debouncedUserSearch.length >= 2,
  });

  const selectedChannel = useMemo(
    () => inbox.find((i) => i.channelId === selectedChannelId),
    [inbox, selectedChannelId],
  );

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessageWithMeta[]>({
    queryKey: messagesKey,
    enabled: !!selectedChannelId,
    staleTime: 30_000, // real-time updates via WS/Supabase — no need to refetch on focus
  });

  const { data: channelMembersData } = useQuery<{ user: { id: string } }[]>({
    queryKey: useMemo(() => selectedChannelId ? [`/api/chat/channels/${selectedChannelId}/members`] : ["no-members"], [selectedChannelId]),
    enabled: !!selectedChannelId,
    staleTime: 60_000,
  });
  const memberCount = channelMembersData?.length ?? 0;

  useEffect(() => {
    setMergedMessages(messages);
    setOldestLoadedId(messages[0]?.id);
    setHasMore(messages.length >= 50);
  }, [messages, selectedChannelId]);

  useEffect(() => {
    if (!selectedChannelId) return;
    void apiRequest("POST", `/api/chat/channels/${selectedChannelId}/read`, {});
    void queryClient.invalidateQueries({ queryKey: inboxQueryKey });
  }, [selectedChannelId, queryClient, inboxQueryKey]);

  const invalidateChat = useCallback(() => {
    if (selectedChannelId) {
      void queryClient.invalidateQueries({ queryKey: messagesKey });
    }
    void queryClient.invalidateQueries({ queryKey: inboxQueryKey });
  }, [queryClient, selectedChannelId, messagesKey, inboxQueryKey]);

  useChatSupabaseRealtime(
    selectedChannelId,
    Boolean(chatConfig?.supabaseRealtime),
    invalidateChat,
  );

  useEffect(() => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat?userId=${user.id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (selectedChannelId) {
        ws.send(JSON.stringify({ type: "join", payload: { channelId: selectedChannelId } }));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "message":
        case "reaction":
        case "delete":
          invalidateChat();
          break;
        case "typing":
          setTypingUsers((prev) => {
            const next = new Map(prev);
            const set = new Set(next.get(data.payload?.channelId) ?? []);
            if (data.payload?.isTyping === false) set.delete(data.payload.userId);
            else set.add(data.payload.userId);
            next.set(data.payload.channelId, set);
            return next;
          });
          break;
        case "presence":
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            if (data.payload?.isOnline) next.add(data.payload.userId);
            else next.delete(data.payload.userId);
            return next;
          });
          break;
        case "poll_vote":
          if (data.payload?.pollId) {
            void queryClient.invalidateQueries({ queryKey: [`/api/chat/polls/${data.payload.pollId}`] });
          }
          break;
      }
    };

    return () => ws.close();
  }, [user, invalidateChat, queryClient]);

  useEffect(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN && selectedChannelId) {
      ws.send(JSON.stringify({ type: "join", payload: { channelId: selectedChannelId } }));
    }
  }, [selectedChannelId]);

  useEffect(() => {
    // Desktop: auto-open first conversation; mobile: stay on list until user picks one
    if (!selectedChannelId && inbox.length > 0 && !isMobile) {
      selectChannel(inbox[0].channelId);
    }
  }, [inbox, selectedChannelId, isMobile, selectChannel]);

  const showSidebar = !isMobile || !selectedChannelId;
  const showThread = !isMobile || !!selectedChannelId;

  const toggleSection = (key: keyof ChatSectionState) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveChatSections(next);
      return next;
    });
  };

  const [favoritingChannelId, setFavoritingChannelId] = useState<number | null>(null);

  const toggleFavorite = useMutation({
    mutationFn: async ({ channelId, isFavorite }: { channelId: number; isFavorite: boolean }) => {
      setFavoritingChannelId(channelId);
      if (isFavorite) {
        return apiRequest("DELETE", `/api/chat/channel-favorites/${channelId}`);
      }
      return apiRequest("POST", `/api/chat/channel-favorites/${channelId}`, {});
    },
    onSettled: () => setFavoritingChannelId(null),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, attachmentIds }: { content: string; attachmentIds?: number[] }) =>
      apiRequest("POST", `/api/chat/channels/${selectedChannelId}/messages`, {
        content: content || " ",
        attachmentIds,
      }),
    onSuccess: () => {
      setNewMessage("");
      invalidateChat();
    },
  });

  const summarizeUnread = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/chat/channels/${selectedChannelId}/summarize-unread`, {}),
    onSuccess: () => invalidateChat(),
  });

  const startDM = useMutation({
    mutationFn: async (otherUserId: string) =>
      apiRequest("POST", "/api/chat/dm", { otherUserId, tenantId }),
    onSuccess: async (res) => {
      const channel = (await res.json()) as { id: number };
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey });
      selectChannel(channel.id);
      setIsNewChatOpen(false);
      setUserSearchQuery("");
    },
  });

  const createChannel = useMutation({
    mutationFn: async (data: { name: string; type: string; projectId?: number }) =>
      apiRequest("POST", "/api/chat/channels", { ...data, tenantId }),
    onSuccess: async (res) => {
      const ch = (await res.json()) as { id: number };
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey });
      setIsCreateChannelOpen(false);
      selectChannel(ch.id);
    },
  });

  const createTeam = useMutation({
    mutationFn: async (data: { name: string; description?: string; isPrivate?: boolean }) =>
      apiRequest("POST", "/api/chat/teams", data),
    onSuccess: async (res) => {
      const { channel } = (await res.json()) as { channel: { id: number } };
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey });
      void queryClient.invalidateQueries({ queryKey: [`/api/chat/projects/user?tenantId=${tenantId}`] });
      setIsCreateTeamOpen(false);
      selectChannel(channel.id);
    },
  });

  const createPoll = useMutation({
    mutationFn: async (data: {
      question: string;
      options: string[];
      durationMinutes: number;
      anonymous: boolean;
      pollType?: "single" | "multi";
      showResultsToVoters?: boolean;
      allowVoteChange?: boolean;
    }) => apiRequest("POST", `/api/chat/channels/${selectedChannelId}/polls`, data),
    onSuccess: () => {
      setIsPollOpen(false);
      invalidateChat();
    },
  });

  const renameTeam = useMutation({
    mutationFn: async ({ projectId, name }: { projectId: number; name: string; oldName: string }) =>
      apiRequest("PATCH", `/api/chat/projects/${projectId}`, { name }),
    onSuccess: (_res, { name, oldName }) => {
      renameCollapsedTeamKey(oldName, name);
      setRenameTeamTarget(null);
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey });
      void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const loadMore = async () => {
    if (!selectedChannelId || !oldestLoadedId || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithAuth(
        `/api/chat/channels/${selectedChannelId}/messages?before=${oldestLoadedId}&limit=50`,
      );
      if (!res.ok) return;
      const older = (await res.json()) as ChatMessageWithMeta[];
      setHasMore(older.length >= 50);
      if (older.length > 0) {
        setOldestLoadedId(older[0].id);
        setMergedMessages((prev) => [...older, ...prev]);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTyping = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedChannelId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    ws.send(JSON.stringify({ type: "typing", payload: { channelId: selectedChannelId } }));
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const typingDisplay = useMemo(() => {
    const set = typingUsers.get(selectedChannelId ?? 0);
    if (!set || set.size === 0) return null;
    const names = Array.from(set).slice(0, 3);
    return `${names.join(", ")} ${set.size === 1 ? "is" : "are"} typing…`;
  }, [typingUsers, selectedChannelId]);

  return (
    <div className="min-h-screen bg-background" data-testid="chat-page">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-screen flex flex-col", mainOffset, mobileTopOffset)}>
        <div className="border-b border-border/30 bg-card shrink-0">
          <ModuleHeader
            icon={MessageSquare}
            title="Chat"
            subtitle={isMobile ? undefined : "Team messaging and collaboration"}
            titleTestId="text-chat-title"
            compact
            actions={
              <>
                <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex" onClick={() => setIsNewChatOpen(true)}>
                  <MessageSquare className="h-4 w-4" /> New Chat
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 hidden md:inline-flex" onClick={() => setIsCreateTeamOpen(true)}>
                  <Users className="h-4 w-4" /> New Team
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex" onClick={() => setIsCreateChannelOpen(true)}>
                  <Hash className="h-4 w-4" /> New Channel
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:hidden shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsNewChatOpen(true)}>
                      <MessageSquare className="h-4 w-4 mr-2" /> New Chat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsCreateTeamOpen(true)}>
                      <Users className="h-4 w-4 mr-2" /> New Team
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsCreateChannelOpen(true)}>
                      <Hash className="h-4 w-4 mr-2" /> New Channel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          />
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {showSidebar && (
            <ConversationSidebar
              inbox={inbox}
              selectedChannelId={selectedChannelId}
              searchQuery={searchQuery}
              sections={sections}
              onlineUsers={onlineUsers}
              onSearchChange={setSearchQuery}
              onSelectChannel={selectChannel}
              onToggleSection={toggleSection}
              onToggleFavorite={(channelId, isFavorite) =>
                toggleFavorite.mutate({ channelId, isFavorite })
              }
              onNewChat={() => setIsNewChatOpen(true)}
              onCreateChannel={() => setIsCreateChannelOpen(true)}
              onCreateTeam={() => setIsCreateTeamOpen(true)}
              onRenameTeam={(projectId, name) => setRenameTeamTarget({ projectId, name })}
              inboxLoading={inboxLoading}
              favoritingChannelId={favoritingChannelId}
              className={cn(isMobile && "w-full border-r-0")}
            />
          )}

          {showThread && selectedChannel ? (
            <>
              <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
                <MessageThread
                  channel={selectedChannel}
                  messages={mergedMessages}
                  messagesLoading={messagesLoading}
                  currentUserId={user?.id ?? ""}
                  typingDisplay={typingDisplay}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  aiEnabled={chatConfig?.aiEnabled}
                  memberCount={memberCount}
                  onBack={isMobile ? backToConversationList : undefined}
                  onLoadMore={() => void loadMore()}
                  onOpenThread={(messageId) =>
                    setRightPanel({ type: "thread", messageId, channelId: selectedChannel.channelId })
                  }
                  onOpenMembers={() =>
                    setRightPanel({
                      type: "members",
                      channelId: selectedChannel.channelId,
                      notificationPref: selectedChannel.notificationPref,
                    })
                  }
                  onOpenSearch={() =>
                    setRightPanel({ type: "search", channelId: selectedChannel.channelId })
                  }
                  onOpenPins={() =>
                    setRightPanel({ type: "pins", channelId: selectedChannel.channelId })
                  }
                  onOpenBridge={() =>
                    setRightPanel({ type: "bridge", channelId: selectedChannel.channelId })
                  }
                  onSummarizeUnread={() => summarizeUnread.mutate()}
                  summarizeUnreadPending={summarizeUnread.isPending}
                  onInvalidate={invalidateChat}
                />
                <MessageCompose
                  channel={selectedChannel}
                  channelId={selectedChannel.channelId}
                  value={newMessage}
                  mentionUsers={tenantUsers}
                  maxAttachments={chatConfig?.maxAttachmentsPerMessage ?? 5}
                  onChange={setNewMessage}
                  onSend={(attachmentIds) => {
                    const text = newMessage.trim();
                    if (text || attachmentIds.length) {
                      sendMessage.mutate({ content: text, attachmentIds });
                    }
                  }}
                  onTyping={handleTyping}
                  onOpenPoll={() => setIsPollOpen(true)}
                  disabled={sendMessage.isPending}
                  sending={sendMessage.isPending}
                />
              </div>
              <ChatRightPanel
                panel={rightPanel}
                currentUserId={user?.id ?? ""}
                isMobile={isMobile}
                onClose={() => setRightPanel(null)}
                onJumpToMessage={(messageId) => {
                  // Scroll to message in merged list — find it and scroll into view
                  setRightPanel(null);
                  setTimeout(() => {
                    const el = document.querySelector(`[data-testid="message-${messageId}"]`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    el?.classList.add("ring-2", "ring-indigo-400/50");
                    setTimeout(() => el?.classList.remove("ring-2", "ring-indigo-400/50"), 2000);
                  }, 100);
                }}
              />
            </>
          ) : showThread && inboxLoading ? (
            <div className="flex-1 flex items-center justify-center min-w-0">
              <ChatSpinner label="Loading conversations…" />
            </div>
          ) : showThread ? (
            <div className="flex-1 flex items-center justify-center min-w-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md px-6">
                <MessageSquare className="h-14 w-14 mx-auto text-indigo-400/60 mb-4" />
                <h3 className="font-semibold text-xl mb-2">Welcome to Chat</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Select a conversation or start a new one.
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={() => setIsCreateChannelOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Create channel
                  </Button>
                  <Button variant="outline" onClick={() => setIsNewChatOpen(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" /> Start a chat
                  </Button>
                </div>
              </motion.div>
            </div>
          ) : null}
        </div>
      </main>

      <NewChatDialog
        open={isNewChatOpen}
        onOpenChange={setIsNewChatOpen}
        searchUsers={searchUsers}
        userSearchQuery={userSearchQuery}
        onSearchChange={setUserSearchQuery}
        onSelectUser={(id) => startDM.mutate(id)}
        currentUserId={user?.id}
        isSearching={searchUsersFetching}
        isStarting={startDM.isPending}
      />
      <CreateChannelDialog
        open={isCreateChannelOpen}
        onOpenChange={setIsCreateChannelOpen}
        projects={projects}
        onCreate={(data) => createChannel.mutate(data)}
        pending={createChannel.isPending}
      />
      <CreateTeamDialog
        open={isCreateTeamOpen}
        onOpenChange={setIsCreateTeamOpen}
        onCreate={(data) => createTeam.mutate(data)}
        pending={createTeam.isPending}
      />
      <PollCreatorDialog
        open={isPollOpen}
        onOpenChange={setIsPollOpen}
        onSubmit={(data) => createPoll.mutate(data)}
        pending={createPoll.isPending}
      />
      <RenameTeamDialog
        open={renameTeamTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTeamTarget(null);
        }}
        teamName={renameTeamTarget?.name ?? ""}
        onRename={(name) => {
          if (renameTeamTarget) {
            renameTeam.mutate({
              projectId: renameTeamTarget.projectId,
              name,
              oldName: renameTeamTarget.name,
            });
          }
        }}
        pending={renameTeam.isPending}
      />
    </div>
  );
}
