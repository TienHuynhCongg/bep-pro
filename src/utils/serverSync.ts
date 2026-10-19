import { KitchenTask, ShiftLog, StaffUser, NavItem, DeleteRequest } from '../types';

export interface ServerSyncPayload {
  tasks?: KitchenTask[];
  logs?: ShiftLog[];
  staffList?: StaffUser[];
  toolbarItems?: NavItem[];
  deleteRequests?: DeleteRequest[];
  notification?: {
    kind: 'TASK_TOGGLED' | 'TASK_ASSIGNED' | 'DELETE_REQUEST' | 'MANAGER_1430_CHECK';
    taskTitle?: string;
    staffName?: string;
    isCompleted?: boolean;
    assignedStaffName?: string;
    priority?: string;
    assignedBy?: string;
    requesterName?: string;
    newRequestLabel?: string;
    completedCount?: number;
    totalCount?: number;
    urgentPendingCount?: number;
  };
  senderId?: string;
}

const CLIENT_SENDER_ID = `client_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

export function getClientSenderId(): string {
  return CLIENT_SENDER_ID;
}

export async function pushStateToServer(payload: ServerSyncPayload): Promise<boolean> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        senderId: CLIENT_SENDER_ID,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchStateFromServer(): Promise<{
  ok: boolean;
  state?: {
    tasks?: KitchenTask[];
    logs?: ShiftLog[];
    staffList?: StaffUser[];
    toolbarItems?: NavItem[];
    deleteRequests?: DeleteRequest[];
    updatedAt?: number;
  };
}> {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
