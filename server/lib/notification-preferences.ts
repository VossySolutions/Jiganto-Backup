import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type UserNotificationPreferences,
} from "@shared/models/auth";

export function mergeNotificationPreferences(
  raw: unknown,
): UserNotificationPreferences {
  const base = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Record<string, unknown>;
  return {
    emailWorkflow: p.emailWorkflow !== undefined ? !!p.emailWorkflow : base.emailWorkflow,
    emailInvitations:
      p.emailInvitations !== undefined ? !!p.emailInvitations : base.emailInvitations,
    emailWeeklyDigest:
      p.emailWeeklyDigest !== undefined ? !!p.emailWeeklyDigest : base.emailWeeklyDigest,
    inAppWorkflow: p.inAppWorkflow !== undefined ? !!p.inAppWorkflow : base.inAppWorkflow,
    inAppMentions: p.inAppMentions !== undefined ? !!p.inAppMentions : base.inAppMentions,
  };
}
