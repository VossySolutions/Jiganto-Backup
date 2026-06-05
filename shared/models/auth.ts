import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table (express-session + connect-pg-simple).
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Application users — one row per person; id matches Supabase auth.users UUID.
// Sync: server/auth/appUserSync.ts, scripts/sql/sync-auth-users.sql, client SupabaseAuthSync.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  preferences: jsonb("preferences").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Personal notification toggles (stored on users.preferences). */
export type UserNotificationPreferences = {
  emailWorkflow?: boolean;
  emailInvitations?: boolean;
  emailWeeklyDigest?: boolean;
  inAppWorkflow?: boolean;
  inAppMentions?: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  emailWorkflow: true,
  emailInvitations: true,
  emailWeeklyDigest: false,
  inAppWorkflow: true,
  inAppMentions: true,
};

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
