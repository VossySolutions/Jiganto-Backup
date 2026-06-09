/** Module 02 accent — Indigo per spec */
export const CHAT_ACCENT = "#4338CA";

const FIVE_MIN_MS = 5 * 60 * 1000;

export function formatMessageTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatListTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return formatMessageTime(d);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function formatDateDivider(date: Date | string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function shouldShowMessageHeader(
  prev: { userId: string; createdAt: Date | string } | undefined,
  current: { userId: string; createdAt: Date | string },
  showDateDivider: boolean,
): boolean {
  if (showDateDivider || !prev) return true;
  if (prev.userId !== current.userId) return true;
  return new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime() > FIVE_MIN_MS;
}

export function getUserInitials(
  firstName?: string | null,
  lastName?: string | null,
  username?: string | null,
): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (username) return username.slice(0, 2).toUpperCase();
  return "??";
}

export function displayPersonName(user?: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  if (!user) return "User";
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return full || user.username || "User";
}

export const CHAT_SECTIONS_KEY = "jiganto-chat-sections";
export const CHAT_TEAM_COLLAPSE_KEY = "jiganto-chat-teams";

export type ChatSectionState = {
  favourites: boolean;
  chats: boolean;
  channels: boolean;
};

export function loadChatSections(): ChatSectionState {
  try {
    const raw = localStorage.getItem(CHAT_SECTIONS_KEY);
    if (raw) return JSON.parse(raw) as ChatSectionState;
  } catch {
    /* ignore */
  }
  return { favourites: true, chats: true, channels: true };
}

export function saveChatSections(state: ChatSectionState): void {
  try {
    localStorage.setItem(CHAT_SECTIONS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Per-team collapsed state: set of team names that are currently collapsed */
export function loadCollapsedTeams(): Set<string> {
  try {
    const raw = localStorage.getItem(CHAT_TEAM_COLLAPSE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

export function saveCollapsedTeams(collapsed: Set<string>): void {
  try {
    localStorage.setItem(CHAT_TEAM_COLLAPSE_KEY, JSON.stringify([...collapsed]));
  } catch {
    /* ignore */
  }
}

/** After renaming a team folder, keep its collapsed/expanded state under the new name. */
export function renameCollapsedTeamKey(oldName: string, newName: string): void {
  const collapsed = loadCollapsedTeams();
  if (!collapsed.has(oldName)) return;
  collapsed.delete(oldName);
  collapsed.add(newName);
  saveCollapsedTeams(collapsed);
}

export const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "✅"];

/** Sidebar typography — section headers (sm) > company/folder (xs) > channel/chat (11px) */
export const chatFont = {
  sidebarTitle: "text-sm font-semibold text-foreground",
  sectionHeader: "text-sm font-semibold text-foreground/90",
  companyGroup: "text-xs font-semibold text-foreground/85",
  teamFolder: "text-xs font-medium text-muted-foreground",
  channelName: "text-[11px] font-normal leading-snug text-foreground/80",
  channelPreview: "text-[10px] text-muted-foreground leading-snug",
  channelMeta: "text-[10px] text-muted-foreground tabular-nums",
  emptyHint: "text-[11px] text-muted-foreground leading-relaxed",
  threadTitle: "text-sm font-semibold leading-tight",
  threadSubtitle: "text-xs text-muted-foreground",
  dateDivider: "text-xs font-medium text-muted-foreground",
  messageAuthor: "text-xs font-semibold",
  messageBody: "text-sm leading-relaxed",
  messageMeta: "text-[11px] text-muted-foreground",
  badge: "text-[10px] font-medium",
  panelTitle: "text-sm font-semibold",
  composeInput: "text-sm",
} as const;
