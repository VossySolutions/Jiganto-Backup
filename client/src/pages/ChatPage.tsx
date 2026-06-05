import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { 
  Hash, 
  Lock, 
  Users, 
  Plus, 
  Send, 
  Search,
  Settings,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  AtSign,
  Smile,
  Paperclip,
  MoreHorizontal,
  Edit2,
  Trash2,
  Reply,
  Building2,
  FolderKanban,
  Circle,
  Star,
  StarOff,
  User,
  UserPlus,
  Sparkles,
  BarChart2,
  Check,
  X,
  Clock
} from "lucide-react";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from "@/lib/queryClient";
import type { Channel, ChatMessage, Project } from "@shared/models/chat";

type ChannelType = "public" | "private" | "direct";

interface ChatUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
}

interface PollData {
  id: number; question: string; options: string[];
  durationMinutes: number; anonymous: boolean; closedAt: string | null;
  voteCounts: number[]; totalVotes: number; myVote: number | null; isClosed: boolean;
}

function PollCard({ pollId, currentUserId }: { pollId: number; currentUserId: string }) {
  const queryClient = useQueryClient();
  const { data: poll, isLoading } = useQuery<PollData>({
    queryKey: [`/api/chat/polls/${pollId}`],
    refetchInterval: 8000,
  });
  const vote = useMutation({
    mutationFn: async (optionIndex: number) => {
      return apiRequest("POST", `/api/chat/polls/${pollId}/vote`, { optionIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/polls/${pollId}`] });
    },
  });
  if (isLoading || !poll) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 w-80 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-3" />
        {[1, 2, 3].map(i => <div key={i} className="h-9 bg-muted rounded mb-2" />)}
      </div>
    );
  }
  const hasVoted = poll.myVote !== null;
  const showBars = hasVoted || poll.isClosed;
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 w-full max-w-md mt-1" data-testid={`poll-card-${pollId}`}>
      <div className="flex items-start gap-2 mb-3">
        <BarChart2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug">{poll.question}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {poll.isClosed ? "Poll closed" : `${poll.totalVotes} vote${poll.totalVotes !== 1 ? "s" : ""}`}
            {poll.anonymous && <span>· Anonymous</span>}
          </p>
        </div>
        {poll.isClosed && (
          <Badge variant="secondary" className="text-[10px] shrink-0">Closed</Badge>
        )}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((option, i) => {
          const count = poll.voteCounts[i] || 0;
          const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
          const isMyVote = poll.myVote === i;
          const canClick = !poll.isClosed && !vote.isPending;
          return (
            <button
              key={i}
              onClick={() => canClick && vote.mutate(i)}
              disabled={!canClick}
              className={cn(
                "w-full text-left rounded-lg border px-3 py-2 text-sm transition-all relative overflow-hidden",
                canClick ? "hover:border-primary hover:bg-primary/5 cursor-pointer" : "cursor-default",
                isMyVote ? "border-primary bg-primary/10 font-medium" : "border-border bg-background",
              )}
              data-testid={`poll-option-${pollId}-${i}`}
            >
              {showBars && (
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-lg transition-all duration-700", isMyVote ? "bg-primary/15" : "bg-muted/60")}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {isMyVote && <Check className="h-3 w-3 text-primary shrink-0" />}
                  <span>{option}</span>
                </span>
                {showBars && (
                  <span className="text-xs text-muted-foreground shrink-0 font-medium">{pct}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!poll.isClosed && hasVoted && (
        <p className="text-xs text-muted-foreground mt-2 text-center">Click any option to change your vote</p>
      )}
    </div>
  );
}

export function ChatPage() {
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [debouncedUserSearchQuery, setDebouncedUserSearchQuery] = useState("");
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<ChannelType>("public");
  const [newChannelProjectId, setNewChannelProjectId] = useState<string>("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<number, Set<string>>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState({
    favourites: true,
    chats: true,
    channels: true,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPollOpen, setIsPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState("1440");
  const [pollAnonymous, setPollAnonymous] = useState(false);

  const tenantId = 1;

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: [`/api/chat/channels?tenantId=${tenantId}`],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: [`/api/chat/projects/user?tenantId=${tenantId}`],
  });

  // Favorites
  type FavoriteUser = { id: number; favoriteUserId: string; user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } };
  const { data: favorites = [] } = useQuery<FavoriteUser[]>({
    queryKey: [`/api/chat/favorites?tenantId=${tenantId}`],
  });

  // Direct Messages
  type DMChannel = Channel & { otherUser: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } };
  const { data: dmChannels = [] } = useQuery<DMChannel[]>({
    queryKey: [`/api/chat/dm?tenantId=${tenantId}`],
  });

  // User Search with debounce
  type SearchUser = { id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null };
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearchQuery(userSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  const { data: searchUsers = [] } = useQuery<SearchUser[]>({
    queryKey: [`/api/chat/users/search?tenantId=${tenantId}&q=${debouncedUserSearchQuery}`],
    enabled: isUserSearchOpen && debouncedUserSearchQuery.length >= 2,
  });

  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chat/channels/${selectedChannelId}/messages`],
    enabled: !!selectedChannelId,
  });

  const createChannel = useMutation({
    mutationFn: async (data: { name: string; type: ChannelType; tenantId: number; projectId?: number }) => {
      return apiRequest("POST", "/api/chat/channels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/channels?tenantId=${tenantId}`] });
      setIsCreateChannelOpen(false);
      setNewChannelName("");
      setNewChannelType("public");
      setNewChannelProjectId("");
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (data: { channelId: number; content: string }) => {
      return apiRequest("POST", `/api/chat/channels/${data.channelId}/messages`, { content: data.content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${selectedChannelId}/messages`] });
      setNewMessage("");
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest("DELETE", `/api/chat/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${selectedChannelId}/messages`] });
    },
  });

  const createPoll = useMutation({
    mutationFn: async (data: { channelId: number; question: string; options: string[]; durationMinutes: number; anonymous: boolean }) => {
      return apiRequest("POST", `/api/chat/channels/${data.channelId}/polls`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${selectedChannelId}/messages`] });
      setIsPollOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollDuration("1440");
      setPollAnonymous(false);
    },
  });

  const handleCreatePoll = () => {
    const validOptions = pollOptions.map(o => o.trim()).filter(o => o.length > 0);
    if (!pollQuestion.trim() || validOptions.length < 2 || !selectedChannelId) return;
    createPoll.mutate({
      channelId: selectedChannelId,
      question: pollQuestion.trim(),
      options: validOptions,
      durationMinutes: Number(pollDuration),
      anonymous: pollAnonymous,
    });
  };

  // Add/remove favorites
  const addFavorite = useMutation({
    mutationFn: async (favoriteUserId: string) => {
      return apiRequest("POST", "/api/chat/favorites", { favoriteUserId, tenantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/favorites?tenantId=${tenantId}`] });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (favoriteUserId: string) => {
      return apiRequest("DELETE", `/api/chat/favorites/${favoriteUserId}?tenantId=${tenantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/favorites?tenantId=${tenantId}`] });
    },
  });

  // Start DM with user
  const startDM = useMutation({
    mutationFn: async (otherUserId: string) => {
      return apiRequest("POST", "/api/chat/dm", { otherUserId, tenantId });
    },
    onSuccess: async (response) => {
      const channel = await response.json();
      queryClient.invalidateQueries({ queryKey: [`/api/chat/dm?tenantId=${tenantId}`] });
      setSelectedChannelId(channel.id);
      setIsUserSearchOpen(false);
      setUserSearchQuery("");
    },
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isFavorite = (userId: string) => favorites.some(f => f.favoriteUserId === userId);

  // Find existing DM channel with a user or create new one
  const selectOrCreateDM = (otherUserId: string) => {
    const existingDM = dmChannels.find(dm => dm.otherUser.id === otherUserId);
    if (existingDM) {
      setSelectedChannelId(existingDM.id);
      setIsUserSearchOpen(false);
      setUserSearchQuery("");
    } else {
      startDM.mutate(otherUserId);
    }
  };

  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?userId=${user.id}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("WebSocket connected");
      if (selectedChannelId) {
        websocket.send(JSON.stringify({ type: "join", payload: { channelId: selectedChannelId } }));
      }
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "message":
          queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${selectedChannelId}/messages`] });
          break;
        case "typing":
          setTypingUsers(prev => {
            const next = new Map(prev);
            const existingTypers = next.get(data.channelId);
            const channelTypers = existingTypers ? new Set(Array.from(existingTypers)) : new Set<string>();
            channelTypers.add(data.userId);
            next.set(data.channelId, channelTypers);
            setTimeout(() => {
              setTypingUsers(prev => {
                const next = new Map(prev);
                const channelTypers = next.get(data.channelId);
                if (channelTypers) {
                  channelTypers.delete(data.userId);
                  next.set(data.channelId, channelTypers);
                }
                return next;
              });
            }, 3000);
            return next;
          });
          break;
        case "presence":
          if (data.payload?.isOnline) {
            setOnlineUsers(prev => new Set(Array.from(prev).concat(data.payload.userId)));
          } else {
            setOnlineUsers(prev => {
              const next = new Set(Array.from(prev));
              next.delete(data.payload?.userId);
              return next;
            });
          }
          break;
        case "delete":
          queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${selectedChannelId}/messages`] });
          break;
        case "poll_vote":
          if (data.payload?.pollId) {
            queryClient.invalidateQueries({ queryKey: [`/api/chat/polls/${data.payload.pollId}`] });
          }
          break;
      }
    };

    websocket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN && selectedChannelId) {
      ws.send(JSON.stringify({ type: "join", payload: { channelId: selectedChannelId } }));
    }
  }, [ws, selectedChannelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChannelId) return;
    
    // Only use REST API for message storage - WebSocket is for real-time broadcast only
    sendMessage.mutate({ channelId: selectedChannelId, content: newMessage.trim() });
  };

  const handleTyping = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedChannelId) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    ws.send(JSON.stringify({ type: "typing", payload: { channelId: selectedChannelId } }));
    
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) return;
    
    createChannel.mutate({
      name: newChannelName.trim(),
      type: newChannelType,
      tenantId,
      projectId: newChannelProjectId ? Number(newChannelProjectId) : undefined,
    });
  };

  const companyChannels = channels.filter(c => !c.projectId);
  const projectChannels = channels.filter(c => c.projectId);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case "private":
        return <Lock className="h-4 w-4" />;
      case "direct":
        return <Users className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getUserInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const currentTypingUsers = typingUsers.get(selectedChannelId || 0);
  const typingDisplay = currentTypingUsers && currentTypingUsers.size > 0
    ? `${Array.from(currentTypingUsers).slice(0, 3).join(", ")} ${currentTypingUsers.size === 1 ? "is" : "are"} typing...`
    : null;

  return (
    <div className="min-h-screen bg-background" data-testid="chat-page">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-screen flex flex-col", mainOffset, mobileTopOffset)}>
        <div className="px-4 pt-4">
          <ModuleWelcomeBanner moduleKey="chat" features={["Real-time messaging", "Channels & DMs", "File sharing", "Thread replies"]} />
        </div>
        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50">
          <ModuleHeader
            icon={MessageSquare}
            title="Chat"
            subtitle="Team messaging and collaboration"
            titleTestId="text-chat-title"
            actions={
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsUserSearchOpen(true)} data-testid="button-new-chat">
                  <MessageSquare className="h-4 w-4" />
                  New Chat
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsCreateChannelOpen(true)} data-testid="button-new-team">
                  <Users className="h-4 w-4" />
                  New Team
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsCreateChannelOpen(true)} data-testid="button-new-channel">
                  <Hash className="h-4 w-4" />
                  New Channel
                </Button>
              </>
            }
          />
        </div>
        <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r bg-gradient-to-b from-card to-card/50 flex flex-col shadow-sm" data-testid="channel-sidebar">
          <div className="h-14 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center px-4 justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">Conversations</h2>
            </div>
            <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid="button-create-channel">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Channel</DialogTitle>
                  <DialogDescription>
                    Create a new channel for your team to communicate.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="channel-name">Channel Name</Label>
                    <Input
                      id="channel-name"
                      placeholder="e.g. general, announcements"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      data-testid="input-channel-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel Type</Label>
                    <RadioGroup value={newChannelType} onValueChange={(v) => setNewChannelType(v as ChannelType)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="public" id="public" />
                        <Label htmlFor="public" className="flex items-center gap-2 font-normal cursor-pointer">
                          <Hash className="h-4 w-4" /> Public - Anyone can join
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="private" id="private" />
                        <Label htmlFor="private" className="flex items-center gap-2 font-normal cursor-pointer">
                          <Lock className="h-4 w-4" /> Private - Invite only
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label>Project Scope (Optional)</Label>
                    <Select value={newChannelProjectId} onValueChange={setNewChannelProjectId}>
                      <SelectTrigger data-testid="select-project-scope">
                        <SelectValue placeholder="Company-wide (no project)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Company-wide (no project)</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={String(project.id)}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleCreateChannel} 
                    className="w-full"
                    disabled={!newChannelName.trim() || createChannel.isPending}
                    data-testid="button-submit-channel"
                  >
                    Create Channel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-search-channels"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {/* Favourites Section */}
              <div>
                <button 
                  onClick={() => toggleSection("favourites")}
                  className="w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold text-foreground/80 uppercase tracking-wide hover-elevate rounded-lg group"
                  data-testid="toggle-favourites"
                >
                  {expandedSections.favourites ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <div className="p-1 rounded-md bg-status-amber text-status-amber-foreground">
                    <Star className="h-3 w-3" />
                  </div>
                  Favourites
                  <Badge className="ml-auto text-xs h-5 bg-status-amber/20 text-status-amber-foreground border-0">{favorites.length}</Badge>
                </button>
                {expandedSections.favourites && (
                  <div className="space-y-0.5 mt-1 ml-2">
                    {favorites.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">No favourites yet</p>
                    ) : (
                      favorites.map((fav) => (
                        <div
                          key={fav.id}
                          onClick={() => selectOrCreateDM(fav.favoriteUserId)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer group hover-elevate"
                          )}
                          data-testid={`favorite-${fav.favoriteUserId}`}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={fav.user.profileImageUrl || undefined} />
                            <AvatarFallback className="text-xs">{getUserInitials(fav.user.firstName || '', fav.user.lastName || '')}</AvatarFallback>
                          </Avatar>
                          <span className="truncate flex-1">{fav.user.firstName} {fav.user.lastName}</span>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); removeFavorite.mutate(fav.favoriteUserId); }}
                            data-testid={`remove-favorite-${fav.favoriteUserId}`}
                          >
                            <StarOff className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Chats (Direct Messages) Section */}
              <div>
                <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                  <button 
                    onClick={() => toggleSection("chats")}
                    className="flex items-center gap-2 hover-elevate rounded-lg px-1 -ml-1"
                    data-testid="toggle-chats"
                  >
                    {expandedSections.chats ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <div className="p-1 rounded-md bg-status-blue text-status-blue-foreground">
                      <MessageSquare className="h-3 w-3" />
                    </div>
                    Chats
                  </button>
                  <Badge className="ml-auto text-xs h-5 bg-status-blue/20 text-status-blue-foreground border-0">{dmChannels.length}</Badge>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-5 w-5"
                    onClick={() => setIsUserSearchOpen(true)}
                    data-testid="button-new-chat"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {expandedSections.chats && (
                  <div className="space-y-0.5 mt-1 ml-2">
                    {dmChannels.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">No chats yet. Start one!</p>
                    ) : (
                      dmChannels.map((dm) => (
                        <div
                          key={dm.id}
                          onClick={() => setSelectedChannelId(dm.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer group",
                            selectedChannelId === dm.id
                              ? "bg-primary/10 text-primary"
                              : "hover-elevate text-foreground/80"
                          )}
                          data-testid={`dm-${dm.id}`}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={dm.otherUser.profileImageUrl || undefined} />
                            <AvatarFallback className="text-xs">{getUserInitials(dm.otherUser.firstName || '', dm.otherUser.lastName || '')}</AvatarFallback>
                          </Avatar>
                          <span className="truncate flex-1">{dm.otherUser.firstName || 'User'} {dm.otherUser.lastName || ''}</span>
                          {!isFavorite(dm.otherUser.id) && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); addFavorite.mutate(dm.otherUser.id); }}
                              data-testid={`add-favorite-${dm.otherUser.id}`}
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Teams & Channels Section */}
              <div>
                <button 
                  onClick={() => toggleSection("channels")}
                  className="w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold text-foreground/80 uppercase tracking-wide hover-elevate rounded-lg"
                  data-testid="toggle-channels"
                >
                  {expandedSections.channels ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <div className="p-1 rounded-md bg-status-purple text-status-purple-foreground">
                    <Users className="h-3 w-3" />
                  </div>
                  Teams & Channels
                  <Badge className="ml-auto text-xs h-5 bg-status-purple/20 text-status-purple-foreground border-0">{companyChannels.length + projectChannels.length}</Badge>
                </button>
                {expandedSections.channels && (
                  <div className="ml-2">
                    {/* Company Channels */}
                    <div className="mt-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground font-medium">
                        <div className="p-0.5 rounded bg-status-green/20">
                          <Building2 className="h-3 w-3 text-status-green-foreground" />
                        </div>
                        Company
                      </div>
                      <div className="space-y-0.5">
                        {companyChannels
                          .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((channel) => (
                            <button
                              key={channel.id}
                              onClick={() => setSelectedChannelId(channel.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                                selectedChannelId === channel.id
                                  ? "bg-primary/10 text-primary"
                                  : "hover-elevate text-foreground/80"
                              )}
                              data-testid={`channel-item-${channel.id}`}
                            >
                              {getChannelIcon(channel.type as ChannelType)}
                              <span className="truncate">{channel.name}</span>
                            </button>
                          ))}
                        {companyChannels.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">No company channels</p>
                        )}
                      </div>
                    </div>

                    {/* Project Channels */}
                    {projectChannels.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground font-medium">
                          <div className="p-0.5 rounded bg-primary/20">
                            <FolderKanban className="h-3 w-3 text-primary" />
                          </div>
                          Projects
                        </div>
                        <div className="space-y-0.5">
                          {projectChannels
                            .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((channel) => (
                              <button
                                key={channel.id}
                                onClick={() => setSelectedChannelId(channel.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                                  selectedChannelId === channel.id
                                    ? "bg-primary/10 text-primary"
                                    : "hover-elevate text-foreground/80"
                                )}
                                data-testid={`channel-item-${channel.id}`}
                              >
                                {getChannelIcon(channel.type as ChannelType)}
                                <span className="truncate">{channel.name}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* User Search Dialog */}
          <Dialog open={isUserSearchOpen} onOpenChange={setIsUserSearchOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start a Conversation</DialogTitle>
                <DialogDescription>
                  Search for a user to start a direct message conversation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-user-search"
                  />
                </div>
                <ScrollArea className="h-64">
                  <div className="space-y-1">
                    {searchUsers.filter(u => user && u.id !== user.id).map((searchUser) => (
                      <button
                        key={searchUser.id}
                        onClick={() => selectOrCreateDM(searchUser.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        data-testid={`search-user-${searchUser.id}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={searchUser.profileImageUrl || undefined} />
                          <AvatarFallback>{getUserInitials(searchUser.firstName || '', searchUser.lastName || '')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{searchUser.firstName} {searchUser.lastName}</p>
                          <p className="text-xs text-muted-foreground">{searchUser.email}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </button>
                    ))}
                    {debouncedUserSearchQuery.length < 2 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Type at least 2 characters to search</p>
                    )}
                    {searchUsers.length === 0 && debouncedUserSearchQuery.length >= 2 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Poll Creator Dialog */}
        <Dialog open={isPollOpen} onOpenChange={setIsPollOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Create a Poll
              </DialogTitle>
              <DialogDescription>Ask your channel a question. Members vote directly in the chat.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div>
                <Label htmlFor="poll-question" className="text-sm font-medium">Question</Label>
                <Input
                  id="poll-question"
                  placeholder="What would you like to ask?"
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  className="mt-1.5"
                  data-testid="input-poll-question"
                  maxLength={200}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Options <span className="text-muted-foreground font-normal">(2–6)</span></Label>
                <div className="mt-1.5 space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={e => {
                          const next = [...pollOptions];
                          next[i] = e.target.value;
                          setPollOptions(next);
                        }}
                        data-testid={`input-poll-option-${i}`}
                        maxLength={100}
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                          data-testid={`button-remove-option-${i}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      data-testid="button-add-option"
                    >
                      + Add option
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="poll-duration" className="text-sm font-medium">Duration</Label>
                  <Select value={pollDuration} onValueChange={setPollDuration}>
                    <SelectTrigger id="poll-duration" className="mt-1.5" data-testid="select-poll-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="1440">24 hours</SelectItem>
                      <SelectItem value="10080">1 week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-0.5" data-testid="toggle-poll-anonymous">
                    <input
                      type="checkbox"
                      checked={pollAnonymous}
                      onChange={e => setPollAnonymous(e.target.checked)}
                      className="rounded border-border h-4 w-4 accent-primary"
                    />
                    <span className="text-sm font-medium">Anonymous</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setIsPollOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={handleCreatePoll}
                  disabled={
                    !pollQuestion.trim() ||
                    pollOptions.filter(o => o.trim()).length < 2 ||
                    createPoll.isPending
                  }
                  data-testid="button-submit-poll"
                >
                  {createPoll.isPending ? "Creating…" : "Post Poll"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex-1 flex flex-col bg-gradient-to-br from-background to-muted/20" data-testid="message-area">
          {selectedChannel ? (
            <>
              <div className="h-16 border-b flex items-center px-6 justify-between bg-card/80 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    selectedChannel.type === "private" 
                      ? "bg-status-amber text-status-amber-foreground" 
                      : selectedChannel.type === "direct" 
                        ? "bg-status-blue text-status-blue-foreground"
                        : "bg-status-green text-status-green-foreground"
                  )}>
                    {selectedChannel.type === "private" ? <Lock className="h-4 w-4" /> : 
                     selectedChannel.type === "direct" ? <User className="h-4 w-4" /> : 
                     <Hash className="h-4 w-4" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg" data-testid="channel-name">{selectedChannel.name}</h3>
                    {selectedChannel.description && (
                      <p className="text-xs text-muted-foreground">{selectedChannel.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs font-medium h-8 px-3 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
                    onClick={() => setIsPollOpen(true)}
                    data-testid="button-new-poll-header"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    New Poll
                  </Button>
                  <div className="w-px h-5 bg-border" />
                  <Button size="icon" variant="ghost" className="rounded-lg h-8 w-8">
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="rounded-lg h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium text-lg">No messages yet</h3>
                      <p className="text-muted-foreground text-sm">Be the first to send a message in this channel.</p>
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const prevMessage = messages[index - 1];
                      const showDateDivider = !prevMessage || 
                        formatDate(message.createdAt) !== formatDate(prevMessage.createdAt);
                      const isOwnMessage = message.userId === user?.id;
                      const showAvatar = !prevMessage || prevMessage.userId !== message.userId || showDateDivider;

                      return (
                        <div key={message.id}>
                          {showDateDivider && (
                            <div className="flex items-center gap-4 my-6">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-xs text-muted-foreground font-medium">
                                {formatDate(message.createdAt)}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div 
                            className={cn(
                              "group flex gap-3 hover:bg-accent/30 -mx-2 px-2 py-1 rounded-md transition-colors",
                              !showAvatar && "pl-12"
                            )}
                            data-testid={`message-${message.id}`}
                          >
                            {showAvatar && (
                              <Avatar className="h-9 w-9 flex-shrink-0">
                                <AvatarImage src={(message as any).user?.profileImageUrl} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getUserInitials(
                                    (message as any).user?.firstName,
                                    (message as any).user?.lastName,
                                    (message as any).user?.username
                                  )}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className="flex-1 min-w-0">
                              {showAvatar && (
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-medium text-sm">
                                    {(message as any).user?.firstName || (message as any).user?.username || "User"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(message.createdAt)}
                                  </span>
                                  {message.isEdited && (
                                    <span className="text-xs text-muted-foreground">(edited)</span>
                                  )}
                                </div>
                              )}
                              {(message as any).messageType === "poll" && (message as any).pollId ? (
                                <PollCard pollId={(message as any).pollId} currentUserId={user?.id || ""} />
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                              )}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
                              {isOwnMessage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => deleteMessage.mutate(message.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {typingDisplay && (
                <div className="px-6 py-1 text-xs text-muted-foreground italic">
                  {typingDisplay}
                </div>
              )}

              <div className="border-t p-4 bg-card/80 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative bg-background rounded-xl border shadow-sm overflow-hidden">
                      <Textarea
                        placeholder={`Message #${selectedChannel?.name || "channel"}`}
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          handleTyping();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="min-h-[48px] max-h-32 resize-none pr-28 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        rows={1}
                        data-testid="input-message"
                      />
                      <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" className="px-2" title="Create a poll" onClick={() => setIsPollOpen(true)} data-testid="button-open-poll-creator">
                          <BarChart2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="px-2">
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="px-2">
                          <Smile className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="px-2">
                          <AtSign className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessage.isPending}
                      size="icon"
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-md"
              >
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-status-blue/20 blur-3xl rounded-full" />
                  <div className="relative p-6 rounded-3xl bg-gradient-to-br from-primary/10 to-status-blue/10 border border-primary/10">
                    <MessageSquare className="h-16 w-16 mx-auto text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold text-2xl mb-3">Welcome to Chat</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Connect with your team in real-time. Select a channel from the sidebar or start a new conversation.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => setIsCreateChannelOpen(true)} className="gap-2" data-testid="button-create-first-channel">
                    <Plus className="h-4 w-4" /> Create Channel
                  </Button>
                  <Button variant="outline" onClick={() => setIsUserSearchOpen(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" /> Start a Chat
                  </Button>
                </div>
                <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  AI-powered suggestions coming soon
                </div>
              </motion.div>
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
