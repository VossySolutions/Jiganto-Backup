import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Phone, Mail, Calendar, Users, Clock, CheckCircle2, AlertCircle, TrendingUp, Activity } from "lucide-react";

type CrmActivity = {
  id: number;
  type: string;
  subject: string;
  description: string | null;
  dueDate: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  location: string | null;
  outcome: string | null;
  completedAt: string | null;
  status: string | null;
  priority: string | null;
  createdAt: string;
};

interface ActivityAnalyticsProps {
  activities: CrmActivity[];
}

export function ActivityAnalytics({ activities }: ActivityAnalyticsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const completedActivities = activities.filter(a => a.completedAt || a.status === "completed");
    const pendingActivities = activities.filter(a => !a.completedAt && a.status !== "completed");
    const overdueActivities = pendingActivities.filter(a => {
      if (!a.dueDate) return false;
      return new Date(a.dueDate) < now;
    });
    
    const thisWeekActivities = activities.filter(a => {
      const date = new Date(a.createdAt);
      return date >= thisWeekStart;
    });
    
    const thisMonthActivities = activities.filter(a => {
      const date = new Date(a.createdAt);
      return date >= thisMonthStart;
    });

    const byType: Record<string, number> = {};
    activities.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + 1;
    });

    const byOutcome: Record<string, number> = {};
    completedActivities.forEach(a => {
      if (a.outcome) {
        byOutcome[a.outcome] = (byOutcome[a.outcome] || 0) + 1;
      }
    });

    const byPriority: Record<string, number> = {};
    activities.forEach(a => {
      const priority = a.priority || "normal";
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });

    const totalDuration = completedActivities.reduce((sum, a) => sum + (a.duration || 0), 0);
    const avgDuration = completedActivities.length > 0 ? Math.round(totalDuration / completedActivities.length) : 0;

    const completionRate = activities.length > 0 ? Math.round((completedActivities.length / activities.length) * 100) : 0;

    return {
      total: activities.length,
      completed: completedActivities.length,
      pending: pendingActivities.length,
      overdue: overdueActivities.length,
      thisWeek: thisWeekActivities.length,
      thisMonth: thisMonthActivities.length,
      byType,
      byOutcome,
      byPriority,
      avgDuration,
      completionRate,
    };
  }, [activities]);

  const typeIcons: Record<string, any> = {
    call: Phone,
    email: Mail,
    meeting: Users,
    task: CheckCircle2,
  };

  const priorityColors: Record<string, string> = {
    high: "bg-destructive",
    normal: "bg-primary",
    low: "bg-muted",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Activity Analytics</h2>
          <p className="text-sm text-muted-foreground">Insights into team activity performance</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-activities">{analytics.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.thisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completion-rate">{analytics.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.completed} of {analytics.total} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-overdue">{analytics.overdue}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-duration">{analytics.avgDuration} min</div>
            <p className="text-xs text-muted-foreground">
              Per completed activity
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activities by Type</CardTitle>
            <CardDescription>Breakdown of activity types</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.byType).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activities recorded</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(analytics.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                  const percentage = Math.round((count / analytics.total) * 100);
                  const Icon = typeIcons[type] || Activity;
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium capitalize">{type}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Priority Distribution</CardTitle>
            <CardDescription>Activities by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.byPriority).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activities recorded</p>
            ) : (
              <div className="space-y-4">
                {["high", "normal", "low"].map((priority) => {
                  const count = analytics.byPriority[priority] || 0;
                  const percentage = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                  return (
                    <div key={priority} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${priorityColors[priority]}`} />
                          <span className="text-sm font-medium capitalize">{priority}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Outcomes</CardTitle>
          <CardDescription>Results from completed activities</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(analytics.byOutcome).length === 0 ? (
            <div className="text-center py-6">
              <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No outcomes recorded yet</p>
              <p className="text-xs text-muted-foreground mt-1">Complete activities with outcomes to see analytics</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(analytics.byOutcome).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => (
                <Badge key={outcome} variant="secondary" className="text-sm">
                  {outcome}: {count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{analytics.thisWeek}</div>
              <p className="text-sm text-muted-foreground mt-1">This Week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{analytics.thisMonth}</div>
              <p className="text-sm text-muted-foreground mt-1">This Month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{analytics.pending}</div>
              <p className="text-sm text-muted-foreground mt-1">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
