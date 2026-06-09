import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle, 
  Workflow, Settings, Trash2, Sparkles, AlertCircle, BellRing,
  Rocket, Zap, ArrowRight, CheckSquare, FileText, Briefcase, 
  MessageSquare, Users, FileSignature, Clock, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/schema";
import { useClientContext } from "@/hooks/use-client-context";
import { isNotificationRelevantInWorkspace } from "@/lib/workspace-nav-filter";

const WHATS_NEW_VERSION = "2026.01.31";
const STORAGE_KEY = "jiganto-whats-new-seen";

const typeIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
  workflow: Workflow,
  system: Settings,
};

const typeColors: Record<string, string> = {
  info: "text-primary",
  warning: "text-brand-orange",
  success: "text-brand-green",
  error: "text-destructive",
  workflow: "text-brand-purple",
  system: "text-muted-foreground",
};

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  isNew: boolean;
  date: string;
}

const features: Feature[] = [
  {
    id: "task-management",
    title: "Task Management",
    description: "Comprehensive task tracking with List and Kanban views.",
    icon: CheckSquare,
    link: "/modules/tasks",
    isNew: true,
    date: "Jan 31",
  },
  {
    id: "document-management",
    title: "Document Management",
    description: "Notion-inspired docs with hierarchical folders.",
    icon: FileText,
    link: "/modules/documents",
    isNew: false,
    date: "Jan 30",
  },
  {
    id: "business-management",
    title: "Business Management",
    description: "Strategic planning with OKRs and initiatives.",
    icon: Briefcase,
    link: "/modules/business-mgmt",
    isNew: false,
    date: "Jan 29",
  },
  {
    id: "crm",
    title: "CRM Module",
    description: "Customer relationship management.",
    icon: Users,
    link: "/modules/crm",
    isNew: false,
    date: "Jan 28",
  },
  {
    id: "chat",
    title: "Team Chat",
    description: "Real-time team communication.",
    icon: MessageSquare,
    link: "/modules/chat",
    isNew: false,
    date: "Jan 27",
  },
];

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("notifications");
  const [hasUnseenWhatsNew, setHasUnseenWhatsNew] = useState(false);
  const [, navigate] = useLocation();
  const { activeClient } = useClientContext();

  useEffect(() => {
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== WHATS_NEW_VERSION) {
      setHasUnseenWhatsNew(true);
    }
  }, []);

  const notifKey = activeClient
    ? `/api/notifications?limit=20&clientId=${activeClient.id}`
    : "/api/notifications?limit=20";

  const { data: rawNotifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: [notifKey],
    refetchInterval: 30000,
  });

  const unreadKey = activeClient
    ? `/api/notifications/unread-count?clientId=${activeClient.id}`
    : "/api/notifications/unread-count";

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: [unreadKey],
    refetchInterval: 30000,
  });

  const { data: pendingSignoffs = [] } = useQuery<any[]>({
    queryKey: ["/api/signoff/my-pending"],
    refetchInterval: 60000,
  });

  const notifications = rawNotifications.filter((n) =>
    isNotificationRelevantInWorkspace(
      { clientId: (n as Notification & { clientId?: number }).clientId, source: n.source },
      activeClient?.id ?? null,
    ),
  );

  const unreadCount = unreadData?.count || 0;
  const alertNotifications = notifications.filter(n => n.type === "error" || n.type === "warning");
  const regularNotifications = notifications.filter(n => n.type !== "error" && n.type !== "warning");
  const unreadAlerts = alertNotifications.filter(n => !n.isRead).length;
  const pendingActionCount = pendingSignoffs.length;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/notifications") });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/notifications") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/notifications") });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleWhatsNewTabClick = () => {
    setActiveTab("whats-new");
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    setHasUnseenWhatsNew(false);
  };

  const handleFeatureClick = (link: string) => {
    navigate(link);
    setIsOpen(false);
  };

  const totalBadgeCount = unreadCount + pendingActionCount + (hasUnseenWhatsNew ? 1 : 0);

  const renderNotificationList = (items: Notification[], emptyMessage: string, emptyIcon: React.ElementType) => {
    const EmptyIcon = emptyIcon;
    
    if (isLoading) {
      return <div className="p-4 text-center text-muted-foreground">Loading...</div>;
    }
    
    if (items.length === 0) {
      return (
        <div className="p-6 text-center">
          <EmptyIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="divide-y">
        {items.map((notification) => {
          const Icon = typeIcons[notification.type || "info"] || Info;
          const colorClass = typeColors[notification.type || "info"] || "text-muted-foreground";
          
          return (
            <div
              key={notification.id}
              className={cn(
                "p-3 hover:bg-muted/50 cursor-pointer transition-colors group",
                !notification.isRead && "bg-primary/5"
              )}
              onClick={() => handleNotificationClick(notification)}
              data-testid={`notification-item-${notification.id}`}
            >
              <div className="flex gap-3">
                <div className={cn("shrink-0 mt-0.5", colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-sm",
                      !notification.isRead && "font-medium"
                    )}>
                      {notification.title}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(notification.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {notification.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {notification.source && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {notification.source}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                    {!notification.isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary ml-auto" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {totalBadgeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" data-testid="notifications-popover">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b px-2 pt-2">
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger 
                value="actions" 
                className="text-xs gap-1"
                data-testid="tab-actions"
              >
                <FileSignature className="h-3.5 w-3.5" />
                Actions
                {pendingActionCount > 0 && (
                  <Badge className="h-4 px-1 text-[10px] bg-amber-500 hover:bg-amber-500">
                    {pendingActionCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="alerts" 
                className="text-xs gap-1"
                data-testid="tab-alerts"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Alerts
                {unreadAlerts > 0 && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    {unreadAlerts}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="text-xs gap-1"
                data-testid="tab-notifications"
              >
                <BellRing className="h-3.5 w-3.5" />
                Updates
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="whats-new" 
                className="text-xs gap-1 relative"
                onClick={handleWhatsNewTabClick}
                data-testid="tab-whats-new"
              >
                <Sparkles className="h-3.5 w-3.5" />
                New
                {hasUnseenWhatsNew && (
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="actions" className="m-0">
            <div className="flex items-center justify-between p-2 border-b">
              <h3 className="text-sm font-medium text-muted-foreground">Awaiting My Sign-off</h3>
              {pendingActionCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                  {pendingActionCount} pending
                </Badge>
              )}
            </div>
            <ScrollArea className="h-[280px]">
              {pendingSignoffs.length === 0 ? (
                <div className="p-6 text-center">
                  <FileSignature className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No sign-off actions pending for you</p>
                </div>
              ) : (
                <div className="divide-y">
                  {pendingSignoffs.map((req: any) => (
                    <div
                      key={req.id}
                      className="p-3 hover:bg-muted/50 transition-colors"
                      data-testid={`action-signoff-${req.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5 h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                          <FileSignature className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug truncate">{req.title}</p>
                          {req.sourceDocument?.title && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              Document: {req.sourceDocument.title}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {req.deadline
                                ? `Due ${new Date(req.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                                : `Sent ${formatDistanceToNow(new Date(req.sentAt || req.createdAt), { addSuffix: true })}`}
                            </span>
                            <span className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded-md ml-1",
                              req.mySignerStatus === "viewed"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            )}>
                              {req.mySignerStatus === "viewed" ? "Viewed" : "Awaiting"}
                            </span>
                          </div>
                          {req.mySignerToken && (
                            <Button
                              size="sm"
                              className="mt-2 h-7 gap-1.5 text-xs w-full"
                              onClick={() => {
                                navigate(`/sign/${req.mySignerToken}`);
                                setIsOpen(false);
                              }}
                              data-testid={`button-sign-now-${req.id}`}
                            >
                              <FileSignature className="h-3.5 w-3.5" />
                              Sign Now
                              <ExternalLink className="h-3 w-3 ml-auto" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="alerts" className="m-0">
            <div className="flex items-center justify-between p-2 border-b">
              <h3 className="text-sm font-medium text-muted-foreground">Critical & Warnings</h3>
            </div>
            <ScrollArea className="h-[280px]">
              {renderNotificationList(alertNotifications, "No alerts", AlertCircle)}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notifications" className="m-0">
            <div className="flex items-center justify-between p-2 border-b">
              <h3 className="text-sm font-medium text-muted-foreground">All Updates</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  data-testid="button-mark-all-read"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="h-[280px]">
              {renderNotificationList(regularNotifications, "No notifications yet", Bell)}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="whats-new" className="m-0">
            <div className="flex items-center gap-2 p-2 border-b bg-gradient-to-r from-primary/5 to-transparent">
              <Rocket className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Latest Features</h3>
            </div>
            <ScrollArea className="h-[280px]">
              <div className="p-2 space-y-2">
                {features.map((feature) => (
                  <Card
                    key={feature.id}
                    className={cn(
                      "hover-elevate cursor-pointer transition-all",
                      feature.isNew && "ring-1 ring-primary/20 bg-primary/[0.02]"
                    )}
                    onClick={() => handleFeatureClick(feature.link)}
                    data-testid={`feature-${feature.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          feature.isNew 
                            ? "bg-primary/10 text-primary" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          <feature.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium">{feature.title}</h4>
                            {feature.isNew && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5">
                                <Zap className="h-2.5 w-2.5 mr-0.5" />
                                New
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">{feature.date}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {feature.description}
                          </p>
                          <Button
                            variant="ghost"
                            className="h-auto p-0 mt-1.5 text-xs text-primary hover:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFeatureClick(feature.link);
                            }}
                          >
                            Explore
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
