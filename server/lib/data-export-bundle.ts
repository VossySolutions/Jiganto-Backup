import { eq } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "@shared/schema";
import { authStorage } from "../auth/storage";
import { storage } from "../storage";
import { mergeNotificationPreferences } from "./notification-preferences";

export type PersonalDataExportBundle = {
  exportedAt: string;
  userId: string;
  profile: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    department: string | null;
    preferences: ReturnType<typeof mergeNotificationPreferences>;
  };
  notifications: Array<{
    id: number;
    title: string;
    message: string | null;
    type: string | null;
    createdAt: Date | null;
    isRead: boolean | null;
  }>;
};

export async function buildPersonalDataExport(
  userId: string,
  orgId: number,
): Promise<PersonalDataExportBundle> {
  const user = await authStorage.getUser(userId);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const userNotifications = await storage.getNotifications(userId, 500);

  return {
    exportedAt: new Date().toISOString(),
    userId,
    profile: {
      email: user?.email ?? null,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      jobTitle: profile?.jobTitle ?? null,
      department: profile?.department ?? null,
      preferences: mergeNotificationPreferences(user?.preferences),
    },
    notifications: userNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      createdAt: n.createdAt,
      isRead: n.isRead,
    })),
  };
}
