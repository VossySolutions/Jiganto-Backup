export interface WorkspaceFullTemplateColumn {
  name: string;
  type: "text" | "number" | "select" | "date" | "checkbox" | "person" | "url" | "multi_select";
  options?: string[];
}

export interface WorkspaceFullTemplateDatabase {
  name: string;
  columns: WorkspaceFullTemplateColumn[];
}

export interface WorkspaceFullTemplatePage {
  title: string;
  pageType: "page" | "database";
  content?: string;
  databases?: WorkspaceFullTemplateDatabase[];
}

export interface WorkspaceFullTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: "system" | "starter" | "advanced";
  pages: WorkspaceFullTemplatePage[];
}

export const WORKSPACE_FULL_TEMPLATES: WorkspaceFullTemplate[] = [
  {
    id: "meeting-management",
    name: "Meeting Management",
    description: "Run recurring meetings with agenda planning, decisions tracking, and action ownership.",
    category: "Project Management",
    tier: "system",
    pages: [
      {
        title: "Meeting Hub",
        pageType: "page",
        content: "<h2>Meeting Management</h2><p>Use this workspace to manage agendas, notes, actions, and decision follow-up.</p>",
      },
      {
        title: "Action Tracker",
        pageType: "database",
        databases: [
          {
            name: "Action Items",
            columns: [
              { name: "Action", type: "text" },
              { name: "Owner", type: "person" },
              { name: "Status", type: "select", options: ["Open", "In Progress", "Done"] },
              { name: "Due Date", type: "date" },
              { name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
            ],
          },
        ],
      },
      {
        title: "Decision Register",
        pageType: "database",
        databases: [
          {
            name: "Decisions",
            columns: [
              { name: "Decision", type: "text" },
              { name: "Date", type: "date" },
              { name: "Approver", type: "person" },
              { name: "Impact", type: "select", options: ["Low", "Medium", "High"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sprint-planning",
    name: "Sprint Planning",
    description: "Plan and execute sprint cycles with backlog refinement and board tracking.",
    category: "Agile",
    tier: "system",
    pages: [
      {
        title: "Sprint Brief",
        pageType: "page",
        content: "<h2>Sprint Planning</h2><p>Define sprint goals, commitments, and team capacity.</p>",
      },
      {
        title: "Sprint Board",
        pageType: "database",
        databases: [
          {
            name: "Sprint Tasks",
            columns: [
              { name: "Task", type: "text" },
              { name: "Status", type: "select", options: ["Backlog", "To Do", "In Progress", "Done"] },
              { name: "Assignee", type: "person" },
              { name: "Story Points", type: "number" },
              { name: "Due Date", type: "date" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "client-onboarding",
    name: "Client Onboarding",
    description: "Standardize onboarding delivery with tasks, dependencies, and stakeholder communication.",
    category: "Business",
    tier: "system",
    pages: [
      {
        title: "Onboarding Playbook",
        pageType: "page",
        content: "<h2>Client Onboarding</h2><p>Capture onboarding goals, timeline, and key points of contact.</p>",
      },
      {
        title: "Onboarding Checklist",
        pageType: "database",
        databases: [
          {
            name: "Checklist",
            columns: [
              { name: "Task", type: "text" },
              { name: "Owner", type: "person" },
              { name: "Status", type: "select", options: ["Not Started", "In Progress", "Completed"] },
              { name: "Due Date", type: "date" },
              { name: "Client Visible", type: "checkbox" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "risk-tracker",
    name: "Risk Tracker",
    description: "Monitor project risks with impact, likelihood, mitigations, and ownership.",
    category: "Governance",
    tier: "system",
    pages: [
      {
        title: "Risk Register",
        pageType: "database",
        databases: [
          {
            name: "Risks",
            columns: [
              { name: "Risk", type: "text" },
              { name: "Likelihood", type: "select", options: ["Low", "Medium", "High"] },
              { name: "Impact", type: "select", options: ["Low", "Medium", "High"] },
              { name: "Owner", type: "person" },
              { name: "Status", type: "select", options: ["Open", "Mitigated", "Closed"] },
              { name: "Review Date", type: "date" },
            ],
          },
        ],
      },
      {
        title: "Mitigation Notes",
        pageType: "page",
        content: "<h2>Mitigation Notes</h2><p>Document mitigation actions, escalation path, and residual risk.</p>",
      },
    ],
  },
  {
    id: "team-okrs",
    name: "Team OKRs",
    description: "Define quarterly objectives, track key results, and align ownership.",
    category: "Strategy",
    tier: "system",
    pages: [
      {
        title: "OKR Overview",
        pageType: "page",
        content: "<h2>Team OKRs</h2><p>Set measurable outcomes and review progress regularly.</p>",
      },
      {
        title: "Objectives & Key Results",
        pageType: "database",
        databases: [
          {
            name: "OKRs",
            columns: [
              { name: "Objective", type: "text" },
              { name: "Key Result", type: "text" },
              { name: "Owner", type: "person" },
              { name: "Progress %", type: "number" },
              { name: "Status", type: "select", options: ["On Track", "At Risk", "Off Track"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "decision-log",
    name: "Decision Log",
    description: "Capture key decisions and rationale to improve transparency and traceability.",
    category: "Governance",
    tier: "system",
    pages: [
      {
        title: "Decisions",
        pageType: "database",
        databases: [
          {
            name: "Decision Log",
            columns: [
              { name: "Decision", type: "text" },
              { name: "Rationale", type: "text" },
              { name: "Date", type: "date" },
              { name: "Decision Maker", type: "person" },
              { name: "Status", type: "select", options: ["Proposed", "Approved", "Superseded"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "project-retrospective",
    name: "Project Retrospective",
    description: "Run structured retrospectives with themes, action items, and follow-through.",
    category: "Agile",
    tier: "system",
    pages: [
      {
        title: "Retrospective Notes",
        pageType: "page",
        content: "<h2>Retrospective</h2><p>Capture what went well, what did not, and what to improve next sprint.</p>",
      },
      {
        title: "Retro Actions",
        pageType: "database",
        databases: [
          {
            name: "Actions",
            columns: [
              { name: "Theme", type: "select", options: ["Process", "Delivery", "Quality", "Communication"] },
              { name: "Action", type: "text" },
              { name: "Owner", type: "person" },
              { name: "Due Date", type: "date" },
              { name: "Status", type: "select", options: ["Open", "In Progress", "Done"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "knowledge-base",
    name: "Knowledge Base",
    description: "Organize reusable documentation, SOPs, references, and FAQ content.",
    category: "Operations",
    tier: "system",
    pages: [
      {
        title: "Knowledge Home",
        pageType: "page",
        content: "<h2>Knowledge Base</h2><p>Store operating procedures, guides, and team references in one place.</p>",
      },
      {
        title: "Articles",
        pageType: "database",
        databases: [
          {
            name: "Article Index",
            columns: [
              { name: "Title", type: "text" },
              { name: "Category", type: "select", options: ["Engineering", "Delivery", "Operations", "People"] },
              { name: "Owner", type: "person" },
              { name: "Last Updated", type: "date" },
              { name: "Link", type: "url" },
            ],
          },
        ],
      },
    ],
  },
];
