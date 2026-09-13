import { blocksClient } from "@/lib/blocks/client";
import { teamRole } from "@/features/domain/constants";

export type DeskNotification = {
  kind: "transfer_requested" | "transfer_acknowledged" | "sla_breached" | "next_step_recommended" | "precall_assigned";
  caseId?: string;
  caseNumber?: string;
  title: string;
  body: string;
  href: string;
  team?: string;
};

/**
 * Pushes a desk event to everyone in a team (mapped to its IAM role) through
 * Blocks Notifier. Best-effort: a notification must never block the ownership
 * change it announces, so failures are swallowed and logged.
 */
export async function notifyTeam(team: string, notification: DeskNotification, extraUserIds: string[] = []): Promise<void> {
  try {
    await blocksClient.notifier.notify({
      roles: [teamRole(team)],
      userIds: extraUserIds.length ? extraUserIds : undefined,
      denormalizedPayload: JSON.stringify({ ...notification, team }),
      saveDenormalizedPayloadAsAnObject: true,
      contentAvailable: true
    });
  } catch (error) {
    console.warn("notifier.notify failed", error);
  }
}

export async function notifyUsers(userIds: string[], notification: DeskNotification): Promise<void> {
  if (!userIds.length) return;
  try {
    await blocksClient.notifier.notify({
      userIds,
      denormalizedPayload: JSON.stringify(notification),
      saveDenormalizedPayloadAsAnObject: true,
      contentAvailable: true
    });
  } catch (error) {
    console.warn("notifier.notify failed", error);
  }
}

export type InboxItem = { id: string; isRead: boolean; createdTime?: string; notification: DeskNotification | undefined };

function parsePayload(raw: unknown): DeskNotification | undefined {
  if (!raw) return undefined;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (value && typeof value === "object" && typeof (value as DeskNotification).title === "string") return value as DeskNotification;
  } catch {
    return undefined;
  }
  return undefined;
}

export async function fetchInbox(): Promise<{ items: InboxItem[]; unread: number }> {
  const response = await blocksClient.notifier.getNotifications({ page: 1, pageSize: 20, sortDescending: true });
  const list = Array.isArray(response?.notifications) ? response.notifications : [];
  const items: InboxItem[] = list.map((raw) => {
    const record = raw as Record<string, unknown>;
    return {
      id: String(record.id ?? record.itemId ?? record.correlationId ?? ""),
      isRead: Boolean(record.isRead),
      createdTime: typeof record.createdTime === "string" ? record.createdTime : undefined,
      notification: parsePayload(record.denormalizedPayload ?? record.payload)
    };
  });
  return { items, unread: typeof response?.unReadNotificationsCount === "number" ? response.unReadNotificationsCount : items.filter((item) => !item.isRead).length };
}

export async function markRead(id: string): Promise<void> {
  await blocksClient.notifier.markNotificationAsRead({ id });
}

export async function markAllRead(): Promise<void> {
  await blocksClient.notifier.markAllNotificationAsRead();
}
