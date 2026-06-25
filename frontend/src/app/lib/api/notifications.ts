import { apiDelete, apiGet, apiPut } from "../apiClient";

export interface ApiNotification {
  notification_id: number;
  title: string;
  content: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<ApiNotification[]> {
  return apiGet<ApiNotification[]>(`/notifications/`);
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await apiPut(`/notifications/${notificationId}/read`, {});
}

export async function deleteNotification(notificationId: number): Promise<void> {
  await apiDelete(`/notifications/${notificationId}`);
}
