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
  isSeedReset?: boolean;
}

export type SyncStateStatus = 'synced' | 'syncing' | 'offline' | 'error';

const CLIENT_SENDER_ID = `client_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
const LAST_SERVER_TS_KEY = 'kitchen_last_server_ts_v2';
const LOCAL_LAST_EDIT_TS_KEY = 'kitchen_local_last_edit_ts';
const OFFLINE_QUEUE_KEY = 'kitchen_offline_sync_queue';

let currentSyncStatus: SyncStateStatus = 'synced';
const syncStatusListeners = new Set<(status: SyncStateStatus) => void>();

function setSyncStatus(status: SyncStateStatus) {
  if (currentSyncStatus !== status) {
    currentSyncStatus = status;
    syncStatusListeners.forEach((cb) => cb(status));
  }
}

export function subscribeSyncStatus(cb: (status: SyncStateStatus) => void): () => void {
  syncStatusListeners.add(cb);
  cb(currentSyncStatus);
  return () => {
    syncStatusListeners.delete(cb);
  };
}

export function getClientSenderId(): string {
  return CLIENT_SENDER_ID;
}

// Ghi nhận mốc thời gian người dùng vừa thao tác sửa đổi trên máy này
export function markLocalEdit() {
  try {
    localStorage.setItem(LOCAL_LAST_EDIT_TS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function getLocalLastEditTs(): number {
  try {
    return Number(localStorage.getItem(LOCAL_LAST_EDIT_TS_KEY) || 0);
  } catch {
    return 0;
  }
}

// Mốc thời gian dữ liệu server mới nhất mà máy này từng thấy
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

// Quản lý hàng đợi Offline: Nếu mất mạng hoặc server chậm, giữ lại để tự đẩy lên ngay khi có mạng
function getOfflineQueue(): ServerSyncPayload[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: ServerSyncPayload[]) {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-10)));
    }
  } catch {
    // ignore
  }
}

function queuePayload(payload: ServerSyncPayload) {
  const queue = getOfflineQueue();
  // Gộp payload mới vào đuôi hàng đợi
  queue.push(payload);
  saveOfflineQueue(queue);
  setSyncStatus('offline');
}

let isFlushingQueue = false;
export async function flushOfflineQueue(): Promise<void> {
  if (isFlushingQueue) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    if (navigator.onLine && currentSyncStatus === 'offline') {
      setSyncStatus('synced');
    }
    return;
  }

  isFlushingQueue = true;
  setSyncStatus('syncing');

  try {
    while (queue.length > 0) {
      const nextItem = queue[0];
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nextItem,
          senderId: CLIENT_SENDER_ID,
        }),
      });

      if (!res.ok) {
        throw new Error(`Sync HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      if (data?.updatedAt) rememberServerTs(data.updatedAt);

      queue.shift();
      saveOfflineQueue(queue);
    }
    setSyncStatus('synced');
  } catch {
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
  } finally {
    isFlushingQueue = false;
  }
}

// Tự động thử lại đẩy hàng đợi khi mạng kết nối lại hoặc định kỳ 4s
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineQueue();
  });
  window.addEventListener('offline', () => {
    setSyncStatus('offline');
  });
  setInterval(() => {
    if (navigator.onLine && getOfflineQueue().length > 0) {
      flushOfflineQueue();
    }
  }, 4000);
}

export async function pushStateToServer(payload: ServerSyncPayload): Promise<boolean> {
  markLocalEdit();
  setSyncStatus('syncing');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        senderId: CLIENT_SENDER_ID,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      try {
        const data = await res.json();
        rememberServerTs(data?.updatedAt);
      } catch {
        // ignore
      }
      setSyncStatus('synced');
      // Nếu có hàng đợi tồn trước đó, tiện thể đẩy tiếp
      if (getOfflineQueue().length > 0) {
        flushOfflineQueue();
      }
      return true;
    } else {
      // Server trả về lỗi 5xx hoặc 4xx -> đưa vào hàng đợi
      queuePayload(payload);
      return false;
    }
  } catch {
    // Không thể kết nối tới server (mất mạng, render đang khởi động lại) -> lưu hàng đợi offline
    queuePayload(payload);
    return false;
  }
}

export async function fetchStateFromServer(): Promise<{
  ok: boolean;
  state?: ServerState;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch('/api/state', {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      setSyncStatus('offline');
      return { ok: false };
    }
    const data = await res.json();
    setSyncStatus('synced');
    return data;
  } catch {
    setSyncStatus('offline');
    return { ok: false };
  }
}
