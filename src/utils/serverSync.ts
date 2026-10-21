import {
  AppConfig,
  KitchenTask,
  ShiftLog,
  StaffUser,
  NavItem,
  DeleteRequest,
  AppNotificationItem,
  KitchenRecipe,
  InventoryCheckItem,
} from '../types';

export interface ServerSyncPayload {
  tasks?: KitchenTask[];
  logs?: ShiftLog[];
  staffList?: StaffUser[];
  toolbarItems?: NavItem[];
  deleteRequests?: DeleteRequest[];
  notifications?: AppNotificationItem[];
  recipes?: KitchenRecipe[];
  inventory?: InventoryCheckItem[];
  appConfig?: AppConfig;
  notification?: {
    kind: 'TASK_TOGGLED' | 'TASK_ASSIGNED' | 'DELETE_REQUEST' | 'MANAGER_1430_CHECK';
    taskTitle?: string;
    staffName?: string;
    isCompleted?: boolean;
    assignedStaffName?: string;
    priority?: string;
    assignedBy?: string;
    assignedByRole?: string;
    isUrgent?: boolean;
    requesterName?: string;
    newRequestLabel?: string;
    completedCount?: number;
    totalCount?: number;
    urgentPendingCount?: number;
  };
  senderId?: string;
  senderRole?: string;
  senderName?: string;
  actionReason?: string;
}

export interface ServerState {
  initialized?: boolean;
  tasks?: KitchenTask[];
  logs?: ShiftLog[];
  staffList?: StaffUser[];
  toolbarItems?: NavItem[];
  deleteRequests?: DeleteRequest[];
  notifications?: AppNotificationItem[];
  recipes?: KitchenRecipe[];
  inventory?: InventoryCheckItem[];
  appConfig?: AppConfig;
  updatedAt?: number;
}

const CLIENT_SENDER_ID = `client_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
const LAST_SERVER_TS_KEY = 'kitchen_last_server_ts_v2';

export function getClientSenderId(): string {
  return CLIENT_SENDER_ID;
}

// Mốc thời gian dữ liệu server mới nhất mà máy này từng thấy (dùng để phát hiện server bị reset khi deploy)
export function getLastSeenServerTs(): number {
  try {
    return Number(localStorage.getItem(LAST_SERVER_TS_KEY) || 0);
  } catch {
    return 0;
  }
}

export function rememberServerTs(ts?: number) {
  if (!ts) return;
  try {
    if (ts > getLastSeenServerTs()) {
      localStorage.setItem(LAST_SERVER_TS_KEY, String(ts));
    }
  } catch {
    // ignore
  }
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
    if (res.ok) {
      try {
        const data = await res.json();
        rememberServerTs(data?.updatedAt);
      } catch {
        // ignore
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchStateFromServer(): Promise<{
  ok: boolean;
  state?: ServerState;
}> {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
