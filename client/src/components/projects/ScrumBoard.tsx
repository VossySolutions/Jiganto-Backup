import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, GripVertical, AlertCircle, Bug, Bookmark, Zap, ArrowUp, ArrowRight, ArrowDown, MoreHorizontal, CheckCircle2 } from "lucide-react";
import type { PmSprint, PmBacklogItem } from "@shared/models/projects";

interface ScrumBoardProps {
  projectId: number;
  sprintId?: number | null;
}

const backlogItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["user_story", "bug", "task", "epic", "feature", "improvement"]),
  storyPoints: z.number().min(0).max(100).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  acceptanceCriteria: z.string().optional(),
});

type BacklogItemFormValues = z.infer<typeof backlogItemSchema>;

const columns = [
  { id: "backlog", title: "Backlog", color: "bg-slate-100 dark:bg-slate-800" },
  { id: "todo", title: "To Do", color: "bg-blue-50 dark:bg-blue-950" },
  { id: "in_progress", title: "In Progress", color: "bg-yellow-50 dark:bg-yellow-950" },
  { id: "in_review", title: "In Review", color: "bg-purple-50 dark:bg-purple-950" },
  { id: "done", title: "Done", color: "bg-green-50 dark:bg-green-950" },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case "bug":
      return <Bug className="h-4 w-4 text-destructive" />;
    case "user_story":
      return <Bookmark className="h-4 w-4 text-primary" />;
    case "task":
      return <CheckCircle2 className="h-4 w-4 text-brand-green" />;
    case "epic":
      return <Zap className="h-4 w-4 text-brand-purple" />;
    case "feature":
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    default:
      return <Bookmark className="h-4 w-4 text-gray-500" />;
  }
};

const getPriorityIcon = (priority: string | null | undefined) => {
  switch (priority) {
    case "critical":
      return <ArrowUp className="h-4 w-4 text-destructive" />;
    case "high":
      return <ArrowUp className="h-4 w-4 text-brand-orange" />;
    case "medium":
      return <ArrowRight className="h-4 w-4 text-yellow-500" />;
    case "low":
      return <ArrowDown className="h-4 w-4 text-primary" />;
    default:
      return null;
  }
};

const getStoryPointsBadge = (points: number | null | undefined) => {
  if (!points) return null;
  return (
    <Badge variant="outline" className="text-xs px-1.5 py-0.5 rounded-full">
      {points}
    </Badge>
  );
};

export function ScrumBoard({ projectId, sprintId }: ScrumBoardProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>("backlog");
  const { toast } = useToast();

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery<PmSprint[]>({
    queryKey: [`/api/pm/sprints?projectId=${projectId}`],
    enabled: !!projectId,
  });

  const [activeSprintId, setActiveSprintId] = useState<number | null>(sprintId || null);

  const activeSprint = sprints.find(s => s.id === activeSprintId) || sprints.find(s => s.status === "active");

  const { data: backlogItems = [], isLoading: itemsLoading } = useQuery<PmBacklogItem[]>({
    queryKey: [`/api/pm/backlog?projectId=${projectId}${activeSprintId ? `&sprintId=${activeSprintId}` : ''}`],
    enabled: !!projectId,
  });

  const form = useForm<BacklogItemFormValues>({
    resolver: zodResolver(backlogItemSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "user_story",
      storyPoints: 0,
      priority: "medium",
      acceptanceCriteria: "",
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (values: BacklogItemFormValues) => {
      const payload = {
        tenantId: 1,
        projectId,
        sprintId: activeSprintId,
        title: values.title,
        description: values.description,
        itemType: values.type,
        storyPoints: values.storyPoints || 0,
        priority: values.priority,
        acceptanceCriteria: values.acceptanceCriteria,
        status: selectedColumn,
        backlogOrder: backlogItems.length + 1,
      };
      return apiRequest("POST", "/api/pm/backlog", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/backlog?projectId=${projectId}`] });
      toast({ title: "Item created successfully" });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create item", description: err.message, variant: "destructive" });
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PUT", `/api/pm/backlog/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/backlog?projectId=${projectId}`] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update item", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: BacklogItemFormValues) => {
    createItemMutation.mutate(values);
  };

  const getColumnItems = useCallback((columnId: string) => {
    return backlogItems.filter((item) => item.status === columnId);
  }, [backlogItems]);

  const handleDragStart = (e: React.DragEvent, itemId: number) => {
    e.dataTransfer.setData("itemId", itemId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const itemId = parseInt(e.dataTransfer.getData("itemId"));
    if (!isNaN(itemId)) {
      updateItemStatusMutation.mutate({ id: itemId, status: columnId });
    }
  };

  const totalPoints = useMemo(() => {
    return backlogItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  }, [backlogItems]);

  const completedPoints = useMemo(() => {
    return backlogItems.filter(item => item.status === "done").reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  }, [backlogItems]);

  const isLoading = sprintsLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-5 gap-4">
          {columns.map((col) => (
            <Skeleton key={col.id} className="h-96 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <Select
            value={activeSprintId?.toString() || "all"}
            onValueChange={(val) => setActiveSprintId(val === "all" ? null : parseInt(val))}
          >
            <SelectTrigger className="w-48" data-testid="select-sprint">
              <SelectValue placeholder="Select Sprint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Backlog Items</SelectItem>
              {sprints.map((sprint) => (
                <SelectItem key={sprint.id} value={sprint.id.toString()}>
                  {sprint.name} {sprint.status === "active" ? "(Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeSprint && (
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">{totalPoints} total points</Badge>
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                {completedPoints} completed
              </Badge>
              <Badge variant="outline">
                {backlogItems.length} items
              </Badge>
            </div>
          )}
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-item">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Backlog Item</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user_story">User Story</SelectItem>
                          <SelectItem value="bug">Bug</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                          <SelectItem value="epic">Epic</SelectItem>
                          <SelectItem value="feature">Feature</SelectItem>
                          <SelectItem value="improvement">Improvement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="As a user, I want to..." {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the item..." {...field} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="storyPoints"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Story Points</FormLabel>
                        <Select
                          value={field.value?.toString() || "0"}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-points">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[0, 1, 2, 3, 5, 8, 13, 21, 34].map((points) => (
                              <SelectItem key={points} value={points.toString()}>
                                {points}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="acceptanceCriteria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Acceptance Criteria</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Given... When... Then..." {...field} data-testid="input-acceptance" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={createItemMutation.isPending} data-testid="button-submit-item">
                    {createItemMutation.isPending ? "Creating..." : "Create Item"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-5 gap-4 overflow-x-auto min-w-[900px]">
        {columns.map((column) => (
          <div
            key={column.id}
            className={`rounded-lg p-3 min-h-[500px] ${column.color}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
            data-testid={`column-${column.id}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{column.title}</h3>
              <Badge variant="outline" className="text-xs">
                {getColumnItems(column.id).length}
              </Badge>
            </div>

            <div className="space-y-2">
              {getColumnItems(column.id).map((item) => (
                <Card
                  key={item.id}
                  className="cursor-grab active:cursor-grabbing hover-elevate"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          {getTypeIcon(item.itemType || "user_story")}
                          <span className="text-xs text-muted-foreground uppercase">{(item.itemType || "user_story").replace("_", " ")}</span>
                        </div>
                        <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(item.priority)}
                            {getStoryPointsBadge(item.storyPoints)}
                          </div>
                          {item.assigneeId && (
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {item.assigneeId.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {getColumnItems(column.id).length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Drop items here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScrumBoard;
