/**
 * ─────────────────────────────────────────────────────────────
 * GanttChart — Jiganto Integration Example
 * GanttPage.tsx
 *
 * Drop this into your pages/ or app/ directory.
 * Adapt the API calls to match your actual data layer.
 * ─────────────────────────────────────────────────────────────
 */

'use client'; // if using Next.js App Router

import { useCallback, useEffect, useState } from 'react';
import GanttChart from '@/components/GanttChart';
import type { GanttTask, GanttResource, GanttDependency } from '@/components/gantt.types';
import { pmTaskToGanttTask, STATUS_MAP, PRIORITY_MAP } from '@/components/gantt.types';

// ─── Your existing Jiganto types (approximate) ───────────────

interface PmTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  assignee: string | null;
  due_date: string | null;
  parent_id: string | null;
  // Add any extra fields you have
}

interface JigantoUser {
  id: string;
  name: string;
  avatar_color?: string;
  hours_per_day?: number;
}

// ─── GanttPage ───────────────────────────────────────────────

export default function GanttPage() {
  const [tasks,     setTasks]     = useState<GanttTask[]>([]);
  const [resources, setResources] = useState<GanttResource[]>([]);
  const [deps,      setDeps]      = useState<GanttDependency[]>([]);
  const [loading,   setLoading]   = useState(true);

  // ── Load data from your existing API ──
  useEffect(() => {
    async function load() {
      try {
        // Replace these with your actual API endpoints / Supabase calls
        const [tasksRes, usersRes, depsRes] = await Promise.all([
          fetch('/api/pm_tasks'),
          fetch('/api/users'),
          fetch('/api/task_dependencies'),
        ]);

        const rawTasks: PmTask[]      = await tasksRes.json();
        const rawUsers: JigantoUser[] = await usersRes.json();
        const rawDeps: Array<{ from_id: string; to_id: string; type: string }> = await depsRes.json();

        // ── Transform pm_tasks → GanttTask ──
        const ganttTasks: GanttTask[] = rawTasks.map(row =>
          pmTaskToGanttTask({
            id:         row.id,
            title:      row.title,
            status:     row.status,
            priority:   row.priority,
            assignee:   row.assignee ?? undefined,
            due_date:   row.due_date ?? undefined,
            parent_id:  row.parent_id,
          })
        );

        // ── Transform users → GanttResource ──
        const ganttResources: GanttResource[] = rawUsers.map(u => ({
          id:       u.id,
          name:     u.name,
          color:    u.avatar_color ?? randomColor(u.id),
          capacity: u.hours_per_day ?? 7.5,
        }));

        // ── Transform deps ──
        const ganttDeps: GanttDependency[] = rawDeps.map(d => ({
          from: d.from_id,
          to:   d.to_id,
          type: (d.type as 'FS' | 'SS' | 'FF') ?? 'FS',
        }));

        setTasks(ganttTasks);
        setResources(ganttResources);
        setDeps(ganttDeps);
      } catch (err) {
        console.error('Failed to load Gantt data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Write callbacks — the Gantt fires these; you own persistence ──

  const handleTaskUpdate = useCallback(async (task: GanttTask) => {
    // Optimistic: already applied in Gantt internal state
    // Just persist to your backend:
    await fetch(`/api/pm_tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:     task.name,
        status:    reverseStatusMap(task.status),
        priority:  reversePriorityMap(task.priority),
        due_date:  task.end,
        assignee:  task.resources?.[0] ?? null,
        parent_id: task.parent ?? null,
      }),
    });
  }, []);

  const handleTaskAdd = useCallback(async (task: GanttTask) => {
    await fetch('/api/pm_tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:        task.id,   // pass generated ID so Gantt stays in sync
        title:     task.name,
        status:    reverseStatusMap(task.status),
        priority:  reversePriorityMap(task.priority),
        due_date:  task.end,
        assignee:  task.resources?.[0] ?? null,
        parent_id: task.parent ?? null,
      }),
    });
  }, []);

  const handleTaskDelete = useCallback(async (id: string) => {
    await fetch(`/api/pm_tasks/${id}`, { method: 'DELETE' });
  }, []);

  const handleDepsChange = useCallback(async (newDeps: GanttDependency[]) => {
    // Replace entire dep list, or diff and patch — your choice:
    await fetch('/api/task_dependencies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDeps.map(d => ({ from_id: d.from, to_id: d.to, type: d.type }))),
    });
    setDeps(newDeps);
  }, []);

  const handleResourceChange = useCallback(async (newResources: GanttResource[]) => {
    // Resources added inline in the Gantt (new people) — sync back if needed
    setResources(newResources);
    // You may want to persist new resources only:
    // const added = newResources.filter(r => !resources.find(old => old.id === r.id));
    // for (const r of added) await fetch('/api/users', { method: 'POST', body: ... });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1117] text-[#8b949e]">
        Loading plan…
      </div>
    );
  }

  return (
    <GanttChart
      tasks={tasks}
      resources={resources}
      dependencies={deps}
      onTaskUpdate={handleTaskUpdate}
      onTaskAdd={handleTaskAdd}
      onTaskDelete={handleTaskDelete}
      onDependencyChange={handleDepsChange}
      onResourceChange={handleResourceChange}
      defaultView="week"
      defaultZoom={100}
      editable={true}
      // theme="dark"  ← omit to auto-detect from system preference
      // customColumns={[
      //   { id: 'source', label: 'Source', w: 90, visible: true },
      // ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Maps GanttStatus back to your db values */
function reverseStatusMap(s: string): string {
  const map: Record<string, string> = {
    notstarted: 'not_started',
    inprogress: 'in_progress',
    completed:  'completed',
    onhold:     'on_hold',
    atrisk:     'at_risk',
  };
  return map[s] ?? s;
}

function reversePriorityMap(p: string): string {
  return p; // GanttPriority values already match most schemas
}

/** Deterministic colour from a user ID string */
function randomColor(seed: string): string {
  const palette = ['#58a6ff','#3fb950','#bc8cff','#f0883e','#ff7b72','#e3b341','#39d353','#f85149'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}


// ─────────────────────────────────────────────────────────────
// SUPABASE VARIANT
// (replace the fetch calls above with these if you use Supabase)
// ─────────────────────────────────────────────────────────────
//
// import { createClient } from '@supabase/supabase-js'
// const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
//
// // Load:
// const { data: rawTasks } = await supabase.from('pm_tasks').select('*')
// const { data: rawUsers } = await supabase.from('profiles').select('id, name, avatar_color, hours_per_day')
//
// // Update:
// await supabase.from('pm_tasks').update({ title: task.name, ... }).eq('id', task.id)
//
// // Delete:
// await supabase.from('pm_tasks').delete().eq('id', id)
//
// // Real-time updates (optional — auto-sync edits from other users):
// supabase.channel('pm_tasks')
//   .on('postgres_changes', { event: '*', schema: 'public', table: 'pm_tasks' }, payload => {
//     if (payload.eventType === 'UPDATE') {
//       setTasks(prev => prev.map(t => t.id === payload.new.id ? pmTaskToGanttTask(payload.new) : t))
//     }
//   })
//   .subscribe()
