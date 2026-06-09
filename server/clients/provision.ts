import crypto from "crypto";
import { storage } from "../storage";
import type { Client } from "@shared/models/clients";
import { CLIENT_WORKSPACE_CONFIGURABLE_KEYS } from "@shared/client-workspace-modules";

export async function provisionClientWorkspace(
  client: Client,
  creatorUserId: string,
  tenantId: number,
): Promise<void> {
  await storage.addClientUser({
    tenantId,
    clientId: client.id,
    userId: creatorUserId,
    role: "workspace_admin",
    memberType: "si",
    invitedBy: creatorUserId,
    joinedAt: new Date(),
    isActive: 1,
  });

  for (const mod of CLIENT_WORKSPACE_CONFIGURABLE_KEYS) {
    await storage.upsertClientModuleVisibility(
      client.id,
      mod.key,
      mod.defaultVisible ? 1 : 0,
      creatorUserId,
    );
  }

  try {
    const teamName = `${client.name} Team`;
    const { project } = await storage.createChatTeam(creatorUserId, tenantId, {
      name: teamName,
      description: `Chat team for ${client.name}`,
      isPrivate: false,
      memberIds: [],
    });
    const announcements = await storage.createChannel({
      tenantId,
      projectId: project.id,
      name: "announcements",
      description: `Announcements for ${client.name}`,
      type: "public",
      isDefault: false,
      createdById: creatorUserId,
    });
    await storage.addChannelMember({
      channelId: announcements.id,
      userId: creatorUserId,
      role: "admin",
    });
  } catch (err) {
    console.warn("Client workspace chat team provisioning skipped:", err);
  }
}

export function newInvitationToken(): string {
  return crypto.randomUUID();
}
