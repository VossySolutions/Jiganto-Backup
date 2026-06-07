import { storage } from "../storage";
import type { Channel, ChatMessage } from "@shared/models/chat";

type AccessFail = { ok: false; status: number; message: string };
type AccessOk = { ok: true; channel: Channel };

export async function assertCanAccessChannel(
  channelId: number,
  userId: string,
): Promise<AccessOk | AccessFail> {
  const channel = await storage.getChannel(channelId);
  if (!channel) return { ok: false, status: 404, message: "Channel not found" };
  if (channel.type === "private" || channel.type === "direct") {
    const isMember = await storage.isChannelMember(channelId, userId);
    if (!isMember) return { ok: false, status: 403, message: "Access denied" };
  }
  return { ok: true, channel };
}

export async function assertCanAccessMessage(
  messageId: number,
  userId: string,
): Promise<AccessFail | { ok: true; message: ChatMessage; channel: Channel }> {
  const message = await storage.getMessage(messageId);
  if (!message) return { ok: false, status: 404, message: "Message not found" };
  const access = await assertCanAccessChannel(message.channelId, userId);
  if (!access.ok) return access;
  return { ok: true, message, channel: access.channel };
}

export async function assertCanPostToChannel(
  channelId: number,
  userId: string,
): Promise<{ ok: true } | AccessFail> {
  const access = await assertCanAccessChannel(channelId, userId);
  if (!access.ok) return access;
  const { channel } = access;
  if (channel.type === "announcement") {
    const admin = await storage.isChannelAdmin(channelId, userId);
    if (!admin) return { ok: false, status: 403, message: "Only admins can post in announcement channels" };
  }
  return { ok: true };
}
