import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { format, addDays, differenceInDays } from "date-fns";
import { Plus, Calendar as CalendarIcon, Play, Pause, CheckCircle, Clock, Target, TrendingUp, Settings } from "lucide-react";
import type { PmSprint, PmBacklogItem } from "@shared/models/projects";

interface SprintManagementProps {
  projectId: number;
}

const sprintFormSchema = z.object({
  name: z.string().min(1, "Sprint name is required"),
  goal: z.string().optional(),
  startDate: z.date(),
  durationDays: z.number().min(1).max(60).default(14),
  velocity: z.number().min(0).optional(),
});

type SprintFormValues = z.infer<typeof sprintFormSchema>;

const getSprintStatusBadge = (status: string | null | undefined) => {
  switch (status) {
    case "active":
      return <Badge className="bg-brand-green text-white">Active</Badge>;
    case "completed":
      return <Badge className="bg-primary text-white">Completed</Badge>;
    case "planning":
      return <Badge className="bg-yellow-500 text-white">Planning</Badge>;
    default:
      return <Badge variant="outline">Not Started</Badge>;
  }
};

export function SprintManagement({ projectId }: SprintManagementProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: sprints = [], isLoading } = useQuery<PmSprint[]>({
    queryKey: [`/api/pm/sprints?projectId=${projectId}`],
    enabled: !!projectId,
  });

  const { data: backlogItems = [] } = useQuery<PmBacklogItem[]>({
    queryKey: [`/api/pm/backlog?projectId=${projectId}`],
    enabled: !!projectId,
  });

  const form = useForm<SprintFormValues>({
    resolver: zodResolver(sprintFormSchema),
    defaultValues: {
      name: "",
      goal: "",
      durationDays: 14,
      startDate: new Date(),
      velocity: 0,
    },
  });

  const createSprintMutation = useMutation({
    mutationFn: async (values: SprintFormValues) => {
      const endDate = addDays(values.startDate, values.durationDays);
      const payload = {
        tenantId: 1,
        projectId,
        name: values.name,
        goal: values.goal,
        startDate: format(values.startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        durationDays: values.durationDays,
        status: "planning",
        velocity: values.velocity || 0,
      };
      return apiRequest("POST", "/api/pm/sprints", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/sprints?projectId=${projectId}`] });
      toast({ title: "Sprint created successfully" });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create sprint", description: err.message, variant: "destructive" });
    },
  });

  const updateSprintStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PUT", `/api/pm/sprints/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/sprints?projectId=${projectId}`] });
      toast({ title: "Sprint status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update sprint", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: SprintFormValues) => {
    createSprintMutation.mutate(values);
  };

  const activeSprint = sprints.find((s) => s.status === "active");
  const planningSprints = sprints.filter((s) => s.status === "planning" || s.status === "not_started");
  const completedSprints = sprints.filter((s) => s.status === "completed");

  const getSprintBacklogItems = (sprintId: number) => {
    return backlogItems.filter((item) => item.sprintId === sprintId);
  };

  const calculateSprintProgress = (sprintId: number) => {
    const items = getSprintBacklogItems(sprintId);
    if (items.length === 0) return 0;
    const completed = items.filter((item) => item.status === "done").length;
    return Math.round((completed / items.length) * 100);
  };

  const calculateSprintPoints = (sprintId: number) => {
    const items = getSprintBacklogItems(sprintId);
    const total = items.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const completed = items.filter((item) => item.status === "done").reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    return { total, completed };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sprint Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Sprint Management</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-sprint">
              <Plus className="h-4 w-4 mr-2" />
              Create Sprint
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Sprint</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sprint Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Sprint 1" {...field} data-testid="input-sprint-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sprint Goal</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What is the goal for this sprint?" {...field} data-testid="input-sprint-goal" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className="justify-start text-left font-normal" data-testid="button-start-date">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : "Pick a date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="durationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (days)</FormLabel>
                        <Select
                          value={field.value?.toString()}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-duration">
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7">1 week (7 days)</SelectItem>
                            <SelectItem value="10">10 days</SelectItem>
                            <SelectItem value="14">2 weeks (14 days)</SelectItem>
                            <SelectItem value="21">3 weeks (21 days)</SelectItem>
                            <SelectItem value="28">4 weeks (28 days)</SelectItem>
                            <SelectItem value="30">1 month (30 days)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="velocity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Velocity (story points)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-velocity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={createSprintMutation.isPending} data-testid="button-submit-sprint">
                    {createSprintMutation.isPending ? "Creating..." : "Create Sprint"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {activeSprint && (
        <Card className="border-brand-green/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-brand-green" />
                  {activeSprint.name}
                </CardTitle>
                <CardDescription>{activeSprint.goal || "No goal set"}</CardDescription>
              </div>
              {getSprintStatusBadge(activeSprint.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {activeSprint.endDate && differenceInDays(new Date(activeSprint.endDate), new Date())} days left
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeSprint.startDate && format(new Date(activeSprint.startDate), "MMM d")} -{" "}
                    {activeSprint.endDate && format(new Date(activeSprint.endDate), "MMM d")}
                  </p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {calculateSprintPoints(activeSprint.id).completed} / {calculateSprintPoints(activeSprint.id).total}
                  </p>
                  <p className="text-xs text-muted-foreground">Story Points</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">{activeSprint.velocity || 0}</p>
                  <p className="text-xs text-muted-foreground">Velocity</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">{getSprintBacklogItems(activeSprint.id).length}</p>
                  <p className="text-xs text-muted-foreground">Items</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Sprint Progress</span>
                  <span>{calculateSprintProgress(activeSprint.id)}%</span>
                </div>
                <Progress value={calculateSprintProgress(activeSprint.id)} className="h-2" />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSprintStatusMutation.mutate({ id: activeSprint.id, status: "completed" })}
                  data-testid="button-complete-sprint"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Complete Sprint
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeSprint && planningSprints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Start</CardTitle>
            <CardDescription>The following sprints are ready to be started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {planningSprints.map((sprint) => (
                <div key={sprint.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{sprint.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {sprint.durationDays || 14} days | {calculateSprintPoints(sprint.id).total} points
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSprintStatusBadge(sprint.status)}
                    <Button
                      size="sm"
                      onClick={() => updateSprintStatusMutation.mutate({ id: sprint.id, status: "active" })}
                      data-testid={`button-start-sprint-${sprint.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {completedSprints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Sprints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedSprints.slice(0, 5).map((sprint) => {
                const points = calculateSprintPoints(sprint.id);
                return (
                  <div key={sprint.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{sprint.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {sprint.startDate && format(new Date(sprint.startDate), "MMM d")} -{" "}
                        {sprint.endDate && format(new Date(sprint.endDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{points.completed} pts completed</p>
                        <p className="text-xs text-muted-foreground">Velocity: {sprint.velocity || points.completed}</p>
                      </div>
                      {getSprintStatusBadge(sprint.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {sprints.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Sprints Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Create your first sprint to start organizing work into time-boxed iterations. Sprints typically last 1-4 weeks.
            </p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-sprint">
              <Plus className="h-4 w-4 mr-2" />
              Create First Sprint
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SprintManagement;
