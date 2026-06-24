import { AGILE_PALETTE as C } from "./palette";
import type { BurndownPoint, BurnUpPoint, Defect, Epic, Sprint, Story, Workstream } from "./types";

export const DEMO_WORKSTREAMS: Workstream[] = [
  { id: "ws-ai", name: "AI CUI Engine", color: C.blue },
  { id: "ws-o2c", name: "Order to Cash", color: C.teal },
  { id: "ws-p2p", name: "Purchase to Pay", color: C.purple },
  { id: "ws-r2r", name: "Record to Report", color: C.amber },
  { id: "ws-h2r", name: "Hire to Retire", color: C.green },
];

export const EPICS_INIT: Epic[] = [
  { id: "EP-001", wsId: "ws-ai", title: "AI CUI Core Engine", initiative: "AI Platform v2", status: "Active", tshirt: "XL", priority: "Critical", progress: 45, owner: "Sarah K.", creator: "Peter V.", createdAt: "2026-01-10", color: C.blue, stories: 12, storiesDone: 5, tags: ["backend", "AI"], description: "Build the core conversational UI engine powering all AI interactions." },
  { id: "EP-002", wsId: "ws-ai", title: "User Auth & SSO", initiative: "Security Foundation", status: "Active", tshirt: "L", priority: "High", progress: 72, owner: "Mark T.", creator: "Peter V.", createdAt: "2026-01-12", color: C.teal, stories: 8, storiesDone: 6, tags: ["security", "auth"], description: "Enterprise SSO, MFA, and session management." },
  { id: "EP-003", wsId: "ws-ai", title: "Real-Time Collaboration", initiative: "AI Platform v2", status: "Planning", tshirt: "XL", priority: "High", progress: 10, owner: "Priya M.", creator: "Sarah K.", createdAt: "2026-01-15", color: C.purple, stories: 15, storiesDone: 2, tags: ["realtime", "collab"], description: "WebSocket-powered live collaboration across all boards." },
  { id: "EP-004", wsId: "ws-o2c", title: "Sales Order Management", initiative: "ERP Phase 1", status: "Active", tshirt: "L", priority: "Critical", progress: 38, owner: "James L.", creator: "Peter V.", createdAt: "2026-01-18", color: C.amber, stories: 10, storiesDone: 4, tags: ["SAP", "O2C"], description: "End-to-end sales order processing in SAP." },
  { id: "EP-005", wsId: "ws-p2p", title: "Purchase Requisition Flow", initiative: "ERP Phase 1", status: "Planning", tshirt: "M", priority: "High", progress: 5, owner: "Dev A.", creator: "James L.", createdAt: "2026-01-20", color: C.green, stories: 7, storiesDone: 0, tags: ["SAP", "P2P"], description: "PR to PO automation and approval workflows." },
];

export const STORIES_INIT: Story[] = [
  { id: "US-001", epicId: "EP-001", wsId: "ws-ai", title: "As a user, I want to type natural language queries so that I can interact with AI without learning commands", status: "Done", points: 5, tshirt: "M", priority: "Critical", assignee: "Sarah K.", creator: "Sarah K.", createdAt: "2026-01-12", sprint: "Sprint 3", tags: ["AI", "UX"], tasks: 3, tasksDone: 3, ac: ["Input accepts free text", "Response within 2s", "Error handling shown"] },
  { id: "US-002", epicId: "EP-001", wsId: "ws-ai", title: "As a developer, I want streaming responses so that users see output progressively", status: "In Progress", points: 8, tshirt: "L", priority: "Critical", assignee: "Dev A.", creator: "Sarah K.", createdAt: "2026-01-14", sprint: "Sprint 3", tags: ["AI", "stream"], tasks: 4, tasksDone: 2, ac: ["Tokens stream as generated", "Stop button available", "Graceful timeout"] },
  { id: "US-003", epicId: "EP-001", wsId: "ws-ai", title: "As a user, I want conversation history so that I can revisit past AI sessions", status: "To Do", points: 5, tshirt: "M", priority: "High", assignee: "Dev B.", creator: "Sarah K.", createdAt: "2026-01-16", sprint: "Sprint 4", tags: ["AI", "history"], tasks: 3, tasksDone: 0, ac: ["Last 50 sessions stored", "Search by keyword", "Delete session"] },
  { id: "US-004", epicId: "EP-002", wsId: "ws-ai", title: "As an admin, I want SSO integration so that users sign in with corporate credentials", status: "Done", points: 13, tshirt: "L", priority: "Critical", assignee: "Mark T.", creator: "Mark T.", createdAt: "2026-01-13", sprint: "Sprint 2", tags: ["security", "SSO"], tasks: 5, tasksDone: 5, ac: ["SAML 2.0 support", "OIDC support", "Fallback local auth"] },
  { id: "US-005", epicId: "EP-002", wsId: "ws-ai", title: "As a user, I want MFA so that my account is protected", status: "Done", points: 5, tshirt: "S", priority: "High", assignee: "Mark T.", creator: "Mark T.", createdAt: "2026-01-14", sprint: "Sprint 2", tags: ["security", "MFA"], tasks: 3, tasksDone: 3, ac: ["TOTP support", "SMS fallback", "Recovery codes"] },
  { id: "US-006", epicId: "EP-003", wsId: "ws-ai", title: "As a team member, I want to see live cursors so that I know who is editing", status: "In Progress", points: 8, tshirt: "M", priority: "High", assignee: "Priya M.", creator: "Priya M.", createdAt: "2026-01-18", sprint: "Sprint 3", tags: ["realtime"], tasks: 4, tasksDone: 1, ac: ["Cursor shows username", "Updates <100ms", "Fades when idle"] },
  { id: "US-007", epicId: "EP-001", wsId: "ws-ai", title: "As a user, I want context-aware suggestions so that the AI anticipates my needs", status: "Backlog", points: 13, tshirt: "XL", priority: "Medium", assignee: null, creator: "Peter V.", createdAt: "2026-01-20", sprint: null, tags: ["AI"], tasks: 0, tasksDone: 0, ac: [] },
  { id: "US-008", epicId: "EP-004", wsId: "ws-o2c", title: "As a sales rep, I want to create sales orders in SAP so that customer orders are processed automatically", status: "To Do", points: 8, tshirt: "L", priority: "Critical", assignee: "James L.", creator: "James L.", createdAt: "2026-01-22", sprint: "Sprint 3", tags: ["SAP", "O2C"], tasks: 3, tasksDone: 0, ac: ["Order created in SAP", "Stock checked", "Confirmation email sent"] },
];

export const DEFECTS_INIT: Defect[] = [
  { id: "DEF-001", storyId: "US-001", wsId: "ws-ai", title: "AI response cuts off at 500 chars in Firefox", severity: "Major", priority: "High", status: "In Progress", assignee: "Dev A.", creator: "QA Team", createdAt: "2026-02-05", environment: "SIT", sprint: "Sprint 3" },
  { id: "DEF-002", storyId: "US-004", wsId: "ws-ai", title: "SSO redirect loop on SAML timeout", severity: "Critical", priority: "Critical", status: "Fixed", assignee: "Mark T.", creator: "QA Team", createdAt: "2026-02-06", environment: "UAT", sprint: "Sprint 3" },
  { id: "DEF-003", storyId: "US-006", wsId: "ws-ai", title: "Cursor ghost remains after user disconnects", severity: "Minor", priority: "Low", status: "New", assignee: null, creator: "Priya M.", createdAt: "2026-02-10", environment: "Dev", sprint: null },
];

export const SPRINTS_INIT: Sprint[] = [
  { id: "SP-001", wsId: "ws-ai", name: "Sprint 1", status: "Closed", start: "06 Jan 2026", end: "19 Jan 2026", points: 28, done: 28, goal: "Core engine scaffolding" },
  { id: "SP-002", wsId: "ws-ai", name: "Sprint 2", status: "Closed", start: "20 Jan 2026", end: "02 Feb 2026", points: 32, done: 30, goal: "Auth & SSO integration" },
  { id: "SP-003", wsId: "ws-ai", name: "Sprint 3", status: "Active", start: "03 Feb 2026", end: "16 Feb 2026", points: 34, done: 18, goal: "Streaming + collaboration MVP" },
  { id: "SP-004", wsId: "ws-ai", name: "Sprint 4", status: "Planned", start: "17 Feb 2026", end: "02 Mar 2026", points: 21, done: 0, goal: "Context suggestions & history" },
];

export const BURNDOWN_DATA: BurndownPoint[] = [
  { day: "Day 1", ideal: 34, actual: 34 }, { day: "Day 2", ideal: 31.4, actual: 32 },
  { day: "Day 3", ideal: 28.8, actual: 30 }, { day: "Day 4", ideal: 26.1, actual: 29 },
  { day: "Day 5", ideal: 23.5, actual: 26 }, { day: "Day 6", ideal: 20.9, actual: 24 },
  { day: "Day 7", ideal: 18.3, actual: 22 }, { day: "Day 8", ideal: 15.6, actual: 18 },
  { day: "Day 9", ideal: 13.0, actual: 16 }, { day: "Day 10", ideal: 10.4, actual: null },
  { day: "Day 11", ideal: 7.8, actual: null }, { day: "Day 12", ideal: 5.2, actual: null },
  { day: "Day 13", ideal: 2.6, actual: null }, { day: "Day 14", ideal: 0, actual: null },
];

export const BURNUP_DATA: Record<string, BurnUpPoint[]> = {
  "EP-001": [
    { week: "W1", completed: 0, total: 12 }, { week: "W2", completed: 1, total: 12 },
    { week: "W3", completed: 2, total: 12 }, { week: "W4", completed: 3, total: 12 },
    { week: "W5", completed: 5, total: 12 }, { week: "W6", completed: 5, total: 12 },
  ],
  "EP-002": [
    { week: "W1", completed: 0, total: 8 }, { week: "W2", completed: 2, total: 8 },
    { week: "W3", completed: 4, total: 8 }, { week: "W4", completed: 6, total: 8 },
    { week: "W5", completed: 6, total: 8 }, { week: "W6", completed: 6, total: 8 },
  ],
  "EP-003": [
    { week: "W1", completed: 0, total: 15 }, { week: "W2", completed: 0, total: 15 },
    { week: "W3", completed: 1, total: 15 }, { week: "W4", completed: 2, total: 15 },
    { week: "W5", completed: 2, total: 15 }, { week: "W6", completed: 2, total: 15 },
  ],
};
