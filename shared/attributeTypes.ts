import { z } from "zod";

export const ATTRIBUTE_TYPES = {
  TIME_TRACKING: "time_tracking",
  DATE: "date",
  LABELS: "labels",
  CHECKBOX: "checkbox",
  TEXT: "text",
  LONG_TEXT: "long_text",
  CHECKLIST: "checklist",
  LINKS: "links",
  ATTACHMENTS: "attachments",
  NUMBER: "number",
  STATUS: "status",
  PERSON: "person",
  REFERENCE: "reference",
  MEMBERS: "members",
  VOTE: "vote",
  PROGRESS: "progress",
  RATING: "rating",
  EMAIL: "email",
  PHONE: "phone",
  FORMULA: "formula",
  UPDATED_AT: "updated_at",
  CREATED_AT: "created_at",
  CREATED_BY: "created_by",
  BUTTON: "button",
  CUSTOM_ID: "custom_id",
} as const;

export type AttributeType = typeof ATTRIBUTE_TYPES[keyof typeof ATTRIBUTE_TYPES];

export const ATTRIBUTE_TYPE_INFO: Record<AttributeType, {
  label: string;
  description: string;
  icon: string;
  defaultOptions?: Record<string, unknown>;
  readonly?: boolean;
}> = {
  [ATTRIBUTE_TYPES.TIME_TRACKING]: {
    label: "Time Tracking",
    description: "Track time effortlessly. Monitor work progress and log work hours.",
    icon: "Clock",
    defaultOptions: { format: "hours" },
  },
  [ATTRIBUTE_TYPES.DATE]: {
    label: "Date",
    description: "Add dates for events, meetings, and deadlines.",
    icon: "Calendar",
    defaultOptions: { includeTime: false },
  },
  [ATTRIBUTE_TYPES.LABELS]: {
    label: "Labels",
    description: "Create labels/tags for your tasks and projects.",
    icon: "Tag",
    defaultOptions: { colors: ["blue", "green", "yellow", "red", "purple", "orange"] },
  },
  [ATTRIBUTE_TYPES.CHECKBOX]: {
    label: "Checkbox",
    description: "Add a checkbox to tick off tasks when done.",
    icon: "CheckSquare",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.TEXT]: {
    label: "Text",
    description: "Add a short line of text to any item.",
    icon: "Type",
    defaultOptions: { maxLength: 255 },
  },
  [ATTRIBUTE_TYPES.LONG_TEXT]: {
    label: "Long Text",
    description: "Add comments, instructions, and longer pieces of text.",
    icon: "FileText",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.CHECKLIST]: {
    label: "Checklist",
    description: "Create a list of subtasks that can be ticked off.",
    icon: "ListChecks",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.LINKS]: {
    label: "Links",
    description: "Keep important links and documents at your fingertips.",
    icon: "Link",
    defaultOptions: { multiple: true },
  },
  [ATTRIBUTE_TYPES.ATTACHMENTS]: {
    label: "Attachments",
    description: "Add documents, images, reports, and files.",
    icon: "Paperclip",
    defaultOptions: { maxSize: 10485760, allowedTypes: ["*"] },
  },
  [ATTRIBUTE_TYPES.NUMBER]: {
    label: "Number",
    description: "For sales, metrics, or lead acquisition with format options.",
    icon: "Hash",
    defaultOptions: { format: "integer", prefix: "", suffix: "" },
  },
  [ATTRIBUTE_TYPES.STATUS]: {
    label: "Status",
    description: "Track item status with customizable options.",
    icon: "CircleDot",
    defaultOptions: { options: ["To Do", "In Progress", "Done"] },
  },
  [ATTRIBUTE_TYPES.PERSON]: {
    label: "Person",
    description: "Assign a team member to items.",
    icon: "User",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.REFERENCE]: {
    label: "Reference",
    description: "Link related items to one another within a board.",
    icon: "Link2",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.MEMBERS]: {
    label: "Members",
    description: "Assign multiple team members to items.",
    icon: "Users",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.VOTE]: {
    label: "Vote",
    description: "Let team members upvote ideas, features, or projects.",
    icon: "ThumbsUp",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.PROGRESS]: {
    label: "Progress",
    description: "Add a progress bar to track how tasks are progressing.",
    icon: "TrendingUp",
    defaultOptions: { min: 0, max: 100 },
  },
  [ATTRIBUTE_TYPES.RATING]: {
    label: "Rating",
    description: "Rate ideas or work with customizable symbols and colors.",
    icon: "Star",
    defaultOptions: { max: 5, symbol: "star", color: "yellow" },
  },
  [ATTRIBUTE_TYPES.EMAIL]: {
    label: "Email",
    description: "Store contact emails. Click to copy or send.",
    icon: "Mail",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.PHONE]: {
    label: "Phone",
    description: "Store phone numbers. Click to call or text.",
    icon: "Phone",
    defaultOptions: {},
  },
  [ATTRIBUTE_TYPES.FORMULA]: {
    label: "Formula",
    description: "Calculate values using formulas between attributes.",
    icon: "Calculator",
    defaultOptions: { formula: "" },
  },
  [ATTRIBUTE_TYPES.UPDATED_AT]: {
    label: "Updated At",
    description: "Automatically tracks when an item was last edited.",
    icon: "RefreshCw",
    defaultOptions: {},
    readonly: true,
  },
  [ATTRIBUTE_TYPES.CREATED_AT]: {
    label: "Created At",
    description: "Automatically adds a timestamp when items are created.",
    icon: "Clock",
    defaultOptions: {},
    readonly: true,
  },
  [ATTRIBUTE_TYPES.CREATED_BY]: {
    label: "Created By",
    description: "Automatically tracks who created each item with icon and initials.",
    icon: "UserCheck",
    defaultOptions: {},
    readonly: true,
  },
  [ATTRIBUTE_TYPES.BUTTON]: {
    label: "Button",
    description: "Add interactive buttons to trigger actions or automations.",
    icon: "MousePointerClick",
    defaultOptions: { label: "Click", action: "none" },
  },
  [ATTRIBUTE_TYPES.CUSTOM_ID]: {
    label: "Custom ID",
    description: "Assign unique identifiers to track and reference items.",
    icon: "Fingerprint",
    defaultOptions: { prefix: "", autoIncrement: true },
  },
};

export const timeTrackingValueSchema = z.object({
  totalSeconds: z.number().default(0),
  entries: z.array(z.object({
    start: z.string(),
    end: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
});

export const checklistValueSchema = z.array(z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
}));

export const linkValueSchema = z.array(z.object({
  url: z.string().url(),
  title: z.string().optional(),
}));

export const attachmentValueSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.string(),
  size: z.number(),
}));

export const labelValueSchema = z.array(z.object({
  id: z.string(),
  text: z.string(),
  color: z.string(),
}));

export const numberOptionsSchema = z.object({
  format: z.enum(["integer", "decimal", "currency", "percentage"]).default("integer"),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  decimals: z.number().default(2),
  currency: z.string().optional(),
});

export const membersValueSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
}));

export const voteValueSchema = z.object({
  count: z.number().default(0),
  voters: z.array(z.string()).default([]),
});

export const referenceValueSchema = z.array(z.object({
  itemId: z.number(),
  title: z.string(),
}));

export type TimeTrackingValue = z.infer<typeof timeTrackingValueSchema>;
export type ChecklistValue = z.infer<typeof checklistValueSchema>;
export type LinkValue = z.infer<typeof linkValueSchema>;
export type AttachmentValue = z.infer<typeof attachmentValueSchema>;
export type LabelValue = z.infer<typeof labelValueSchema>;
export type NumberOptions = z.infer<typeof numberOptionsSchema>;
export type MembersValue = z.infer<typeof membersValueSchema>;
export type VoteValue = z.infer<typeof voteValueSchema>;
export type ReferenceValue = z.infer<typeof referenceValueSchema>;
