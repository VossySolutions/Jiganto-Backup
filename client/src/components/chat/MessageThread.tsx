import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  Hash,
  Link2,
  Lock,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Reply,
  Search,
  Settings,
  Smile,
  Sparkles,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { renderChatMessageContent } from "@/lib/chat-message-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { ChatAttachmentMeta, ChatInboxItem, ChatMessageWithMeta } from "@shared/models/chat";
import {
  CHAT_ACCENT,
  displayPersonName,
  formatDateDivider,
  formatMessageTime,
  getUserInitials,
  shouldShowMessageHeader,
  QUICK_EMOJIS,
  chatFont,
} from "@/lib/chat-utils";
import { PollCard } from "@/components/chat/PollCard";
import { ChatButtonSpinner } from "@/components/chat/ChatLoading";

export function MessageThread({
  channel,
  messages,
  messagesLoading,
  currentUserId,
  typingDisplay,
  hasMore,
  loadingMore,
  aiEnabled,
  memberCount,
  onBack,
  onLoadMore,
  onOpenThread,
  onOpenMembers,
  onOpenSearch,
  onOpenPins,
  onOpenBridge,
  onSummarizeUnread,
  summarizeUnreadPending,
  onInvalidate,
}: {
  channel: ChatInboxItem;
  messages: ChatMessageWithMeta[];
  messagesLoading: boolean;
  currentUserId: string;
  typingDisplay: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  aiEnabled?: boolean;
  memberCount?: number;
  onBack?: () => void;
  onLoadMore: () => void;
  onOpenThread: (messageId: number) => void;
  onOpenMembers: () => void;
  onOpenSearch: () => void;
  onOpenPins: () => void;
  onOpenBridge: () => void;
  onSummarizeUnread?: () => void;
  summarizeUnreadPending?: boolean;
  onInvalidate: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const [showJump, setShowJump] = useState(false);
  const [emojiFor, setEmojiFor] = useState<number | null>(null);

  const react = useMutation({
    mutationFn: async ({ messageId, emoji, remove }: { messageId: number; emoji: string; remove: boolean }) => {
      if (remove) {
        return apiRequest("DELETE", `/api/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      }
      return apiRequest("POST", `/api/chat/messages/${messageId}/reactions`, { emoji });
    },
    onSuccess: () => onInvalidate(),
  });

  const del = useMutation({
    mutationFn: async (messageId: number) => apiRequest("DELETE", `/api/chat/messages/${messageId}`),
    onSuccess: () => onInvalidate(),
  });

  const togglePin = useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: number; pinned: boolean }) => {
      if (pinned) {
        return apiRequest("DELETE", `/api/chat/channels/${channel.channelId}/pins/${messageId}`);
      }
      return apiRequest("POST", `/api/chat/channels/${channel.channelId}/pins/${messageId}`, {});
    },
    onSuccess: () => onInvalidate(),
  });

  const bridgeActive = channel.bridge?.active;

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  };

  // Scroll to bottom when switching channels
  useEffect(() => {
    scrollToBottom();
  }, [channel.channelId]);

  // Auto-scroll if user is near bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 200;
    if (isNearBottom) scrollToBottom();
  }, [messages.length]);

  // Preserve scroll position when older messages are prepended
  useEffect(() => {
    if (loadingMore) {
      // Capture height before messages are injected
      prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0;
    } else if (prevScrollHeightRef.current > 0) {
      // Restore offset after messages are injected
      const el = scrollRef.current;
      if (el) {
        const added = el.scrollHeight - prevScrollHeightRef.current;
        if (added > 0) el.scrollTop = added;
      }
      prevScrollHeightRef.current = 0;
    }
  }, [loadingMore]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    setShowJump(distFromBottom > 200);
    // Auto-trigger load more when within 120 px of the top
    if (el.scrollTop < 120 && hasMore && !loadingMore) onLoadMore();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 relative bg-gradient-to-br from-background to-muted/10" data-testid="message-area">
      {/* Channel header */}
      <div className="h-12 sm:h-14 border-b flex items-center px-2 sm:px-4 md:px-6 gap-2 sm:gap-3 bg-card/80 backdrop-blur-sm shrink-0">
        {onBack && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 md:hidden"
            onClick={onBack}
            title="Back to conversations"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div
            className="p-1.5 sm:p-2 rounded-xl shrink-0 text-white"
            style={{ backgroundColor: CHAT_ACCENT }}
          >
            {channel.type === "private" ? (
              <Lock className="h-4 w-4" />
            ) : channel.type === "direct" ? (
              <User className="h-4 w-4" />
            ) : channel.type === "announcement" ? (
              <Megaphone className="h-4 w-4" />
            ) : (
              <Hash className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn("truncate", chatFont.threadTitle)} data-testid="channel-name">
                {channel.displayName}
              </h3>
              {bridgeActive && (
                <span className={cn("inline-flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0", chatFont.badge)}>
                  <Link2 className="h-3 w-3" />
                  <span className="hidden sm:inline">{channel.bridge?.provider === "slack" ? "Slack" : "Teams"}</span>
                </span>
              )}
            </div>
            {channel.description ? (
              <p className={cn("truncate max-w-[10rem] sm:max-w-xs hidden sm:block", chatFont.threadSubtitle)}>{channel.description}</p>
            ) : channel.type === "announcement" ? (
              <p className={cn("hidden sm:block", chatFont.threadSubtitle)}>
                {channel.canPost === false
                  ? "Announcements only — admins can post"
                  : "Announcement channel"}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {aiEnabled && channel.unreadCount > 10 && onSummarizeUnread && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs hidden sm:flex"
              onClick={onSummarizeUnread}
              disabled={summarizeUnreadPending}
            >
              {summarizeUnreadPending ? <ChatButtonSpinner /> : <Sparkles className="h-3.5 w-3.5" />}
              {summarizeUnreadPending ? "Summarising…" : "Summarise unread"}
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onOpenSearch} title="Search in channel">
            <Search className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onOpenPins} title="Pinned messages">
            <Pin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-8 gap-1 px-2"
            onClick={onOpenMembers}
            title="Members"
          >
            <Users className="h-4 w-4" />
            {memberCount != null && memberCount > 0 && (
              <span className="text-xs text-muted-foreground">{memberCount}</span>
            )}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 hidden sm:inline-flex" onClick={onOpenBridge} title="Bridge settings">
            <Settings className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 sm:hidden" title="More">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {aiEnabled && channel.unreadCount > 10 && onSummarizeUnread && (
                <DropdownMenuItem onClick={onSummarizeUnread} disabled={summarizeUnreadPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Summarise unread
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onOpenBridge}>
                <Settings className="h-4 w-4 mr-2" />
                Bridge settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {channel.type === "announcement" && channel.canPost === false && (
        <div className="px-4 sm:px-6 py-2 bg-amber-500/10 border-b text-xs sm:text-sm text-amber-900 dark:text-amber-200 shrink-0">
          This is an announcement channel. Only channel admins can send messages.
        </div>
      )}

      {/* Scrollable messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-4"
        onScroll={handleScroll}
      >
        <div className="max-w-3xl mx-auto space-y-1 pb-2">
          {/* Top-of-history indicator — auto-loads on scroll, spinner while in flight */}
          {hasMore && (
            <div className="flex justify-center py-3">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Loading older messages…
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={onLoadMore}
                >
                  ↑ Load older messages
                </button>
              )}
            </div>
          )}
          {messagesLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className={cn("font-medium", chatFont.channelName)}>No messages yet</p>
              <p className={chatFont.channelPreview}>Be the first to send a message.</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const prev = messages[index - 1];
              const showDate = !prev || formatDateDivider(message.createdAt) !== formatDateDivider(prev.createdAt);
              const showHeader = shouldShowMessageHeader(prev, message, showDate);
              const isOwn = message.userId === currentUserId;

              // Show "New messages" divider at the first unread message from others
              const lastRead = channel.lastReadAt ? new Date(channel.lastReadAt) : null;
              const isFirstUnread =
                lastRead !== null &&
                message.userId !== currentUserId &&
                new Date(message.createdAt) > lastRead &&
                (!prev || prev.userId === currentUserId || new Date(prev.createdAt) <= lastRead);

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex items-center gap-4 my-6">
                      <div className="flex-1 h-px bg-border" />
                      <span className={chatFont.dateDivider}>
                        {formatDateDivider(message.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {isFirstUnread && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-blue-500/40" />
                      <span className={cn("font-semibold text-blue-500 shrink-0", chatFont.badge)}>New messages</span>
                      <div className="flex-1 h-px bg-blue-500/40" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "group relative flex gap-2 py-0.5",
                      isOwn ? "flex-row-reverse" : "flex-row",
                    )}
                    data-testid={`message-${message.id}`}
                  >
                    {!isOwn && showHeader ? (
                      <Avatar className="h-8 w-8 shrink-0 mt-1">
                        <AvatarImage src={message.user.profileImageUrl || undefined} />
                        <AvatarFallback className={cn("bg-indigo-100 text-indigo-600", chatFont.badge)}>
                          {getUserInitials(message.user.firstName, message.user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                    ) : !isOwn ? (
                      <div className="w-8 shrink-0" />
                    ) : null}

                    <div className={cn("max-w-[88%] sm:max-w-[75%] min-w-0", isOwn && "items-end flex flex-col")}>
                      {!isOwn && showHeader && (
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className={chatFont.messageAuthor}>{displayPersonName(message.user)}</span>
                          <span className={chatFont.messageMeta}>{formatMessageTime(message.createdAt)}</span>
                        </div>
                      )}

                      {message.messageType === "poll" && message.pollId ? (
                        <PollCard pollId={message.pollId} />
                      ) : (
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 sm:px-4 py-2 whitespace-pre-wrap break-words",
                            chatFont.messageBody,
                            message.authorSource === "jiganto" && !isOwn
                              ? "bg-violet-500/10 border border-violet-500/20 rounded-bl-md"
                              : isOwn
                                ? "bg-indigo-100 text-indigo-950 border border-indigo-200/80 rounded-br-md dark:bg-indigo-950/40 dark:text-indigo-50 dark:border-indigo-800/60"
                                : "bg-muted/50 border border-border/60 rounded-bl-md",
                          )}
                        >
                          {message.authorSource === "jiganto" && !isOwn && (
                            <span className={cn("font-semibold text-violet-600 block mb-1", chatFont.badge)}>Jiganto AI</span>
                          )}
                          {renderChatMessageContent(message.content)}
                          {message.attachments?.length > 0 && (
                            <MessageAttachments attachments={message.attachments} />
                          )}
                        </div>
                      )}

                      {isOwn && (
                        <span className={cn("mt-0.5 px-1", chatFont.messageMeta)}>
                          {formatMessageTime(message.createdAt)}
                        </span>
                      )}

                      {message.isPinned && (
                        <span className={cn("inline-flex items-center gap-1 mt-0.5 px-1", chatFont.messageMeta)}>
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      )}

                      {message.reactions.length > 0 && (
                        <div className={cn("flex flex-wrap gap-1 mt-1", isOwn && "justify-end")}>
                          {message.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              className={cn(
                                "text-xs rounded-full border px-2 py-0.5 hover:bg-muted/60 transition-colors",
                                r.reactedByMe && "border-indigo-500 bg-indigo-100",
                              )}
                              onClick={() =>
                                react.mutate({
                                  messageId: message.id,
                                  emoji: r.emoji,
                                  remove: r.reactedByMe,
                                })
                              }
                              disabled={react.isPending}
                            >
                              {r.emoji} {r.count}
                            </button>
                          ))}
                        </div>
                      )}

                      {message.threadReplyCount > 0 && (
                        <button
                          type="button"
                          className={cn("hover:underline mt-1 px-1 text-left text-indigo-600", chatFont.badge)}
                          onClick={() => onOpenThread(message.id)}
                        >
                          {message.threadReplyCount} repl{message.threadReplyCount === 1 ? "y" : "ies"}
                          {message.threadLastReplyAt &&
                            ` · Last reply ${formatMessageTime(message.threadLastReplyAt)}`}
                        </button>
                      )}

                      {/* Hover action bar */}
                      <div
                        className={cn(
                          "absolute top-0 -translate-y-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border rounded-lg shadow-sm p-0.5 z-10",
                          isOwn ? "right-0" : "right-0",
                        )}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="React"
                          onClick={() => setEmojiFor(emojiFor === message.id ? null : message.id)}
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Reply in thread"
                          onClick={() => onOpenThread(message.id)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title={message.isPinned ? "Unpin" : "Pin"}
                          onClick={() =>
                            togglePin.mutate({ messageId: message.id, pinned: !!message.isPinned })
                          }
                          disabled={togglePin.isPending}
                        >
                          {togglePin.isPending ? (
                            <ChatButtonSpinner className="h-3.5 w-3.5" />
                          ) : message.isPinned ? (
                            <PinOff className="h-3.5 w-3.5" />
                          ) : (
                            <Pin className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {isOwn && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => del.mutate(message.id)}
                            disabled={del.isPending}
                          >
                            {del.isPending ? (
                              <ChatButtonSpinner className="h-3.5 w-3.5" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="More">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {emojiFor === message.id && (
                        <div className={cn("flex gap-1 mt-1 p-1 rounded-lg border bg-popover shadow-sm z-10", isOwn && "flex-row-reverse")}>
                          {QUICK_EMOJIS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              className="text-base p-1 hover:bg-muted rounded disabled:opacity-50"
                              onClick={() => {
                                react.mutate({ messageId: message.id, emoji: e, remove: false });
                                setEmojiFor(null);
                              }}
                              disabled={react.isPending}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {typingDisplay && (
        <div className={cn("px-4 sm:px-6 py-1.5 italic border-t bg-card/50 shrink-0", chatFont.messageMeta)}>
          {typingDisplay}
        </div>
      )}

      {showJump && (
        <div className="absolute bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg gap-1 pointer-events-auto"
            onClick={() => scrollToBottom(true)}
          >
            Jump to bottom <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MessageAttachments({ attachments }: { attachments: ChatAttachmentMeta[] }) {
  return (
    <div className="mt-2 space-y-2">
      {attachments.map((a) =>
        a.mimeType.startsWith("image/") ? (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
            <img src={a.url} alt={a.fileName} className="max-w-full rounded-lg max-h-48 object-cover" />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border text-xs hover:underline"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{a.fileName}</span>
          </a>
        ),
      )}
    </div>
  );
}
