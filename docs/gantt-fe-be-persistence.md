# Gantt persistence — Monday-style unified work items (2026-07-22h)

## Model

Every Gantt row (except the synthetic Project root) is a **`pm_tasks`** row.

| Engine type | `ganttType` |
|-------------|-------------|
| Phase (2) | `phase` |
| Workstream (3) | `workstream` |
| Activity (4) | `activity` |
| Task (5) | `task` |
| Milestone (6) | `milestone` |

**Type is a property** — change it in Edit and it saves on the same row (Monday.com-style).

## Migration

On first `GET /api/pm/projects/:id/tasks`, [`ensureProjectUnifiedWorkItems`](server/lib/unified-work-items.ts):

1. Adds columns (`rag_status`, `phase_number`, `methodology`, `legacy_source`, `legacy_source_id`)
2. Copies phases / workstreams / milestones into `pm_tasks`
3. Re-parents leaf tasks under phase items
4. Sets `project.metadata.unifiedWorkItems = true`

## APIs

- Gantt load/save: **only** `/api/pm/tasks`
- Compatibility: `GET` phases / workstreams / milestones return unified rows shaped as legacy objects

## Verify

1. Hard-refresh Gantt (`v20260722h`)
2. Edit a Phase → change Type to **Task** → Save → refresh → still Task
3. Set Pred between two items → refresh → Pred kept
4. Milestone Tracker still lists milestones
5. Critical path still works
