/**
 * Notification, Service Worker & Background Web Push Helper
 * Cho phép ứng dụng hoạt động ngầm và nhận thông báo kể cả khi tắt app / kill app / khóa màn hình
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Hiển thị thông báo hệ thống chuẩn Mobile PWA (ưu tiên qua Service Worker để hiện trên màn hình khóa iOS/Android)
 */
export const showSystemNotification = async (
  title: string,
  body: string,
  isUrgent = false,
  tag?: string
) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(isUrgent ? [400, 100, 400, 100, 500] : [180, 80, 180]);
    } catch {
      // ignore
    }
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notifTag = tag || `bep-pro-${Date.now()}`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: notifTag,
          requireInteraction: isUrgent,
          silent: false,
          data: { url: '/', timestamp: Date.now() },
        });
        return;
      }
    }
  } catch {
    // Fallback to standard Notification constructor below
  }

  try {
    new Notification(title, {
      body,
      icon: '/icon.svg',
      tag: notifTag,
      silent: false,
    });
  } catch {
    // ignore
  }
};

/**
 * Đăng ký Service Worker + Web Push VAPID + Periodic Background Sync
 * Giúp điện thoại nhận thông báo ngay cả khi đóng hẳn (kill app) hoặc tắt màn hình
 */
export const registerBackgroundPush = async (user?: {
  id?: string;
  role?: string;
  fullName?: string;
} | null): Promise<{ ok: boolean; subscribed: boolean; message?: string }> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, subscribed: false, message: 'Trình duyệt không hỗ trợ Service Worker' };
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // Đăng ký Periodic Background Sync & Background Sync (nếu trình duyệt hỗ trợ)
    try {
      const anyReg = reg as any;
      if (anyReg.periodicSync && 'register' in anyReg.periodicSync) {
        await anyReg.periodicSync.register('bep-pro-bg-sync', {
          minInterval: 60 * 1000,
        });
      }
      if (anyReg.sync && 'register' in anyReg.sync) {
        await anyReg.sync.register('bep-pro-bg-sync');
      }
    } catch {
      // ignore if permission not granted for periodicsync
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return { ok: true, subscribed: false, message: 'Chưa cấp quyền thông báo' };
    }

    if (!('pushManager' in reg)) {
      return { ok: true, subscribed: false, message: 'Thiết bị dùng thông báo Service Worker cục bộ' };
    }

    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) {
      return { ok: true, subscribed: false };
    }
    const keyData = await keyRes.json();
    if (!keyData?.publicKey) {
      return { ok: true, subscribed: false };
    }

    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Kiểm tra xem subscription có khớp với VAPID Key hiện tại của server không
      try {
        const existingKeyRaw = sub.options?.applicationServerKey;
        if (existingKeyRaw) {
          const currentKeyBytes = urlBase64ToUint8Array(keyData.publicKey);
          const existingKeyBytes = new Uint8Array(existingKeyRaw);
          let keyMismatch = existingKeyBytes.length !== currentKeyBytes.length;
          if (!keyMismatch) {
            for (let i = 0; i < existingKeyBytes.length; i++) {
              if (existingKeyBytes[i] !== currentKeyBytes[i]) {
                keyMismatch = true;
                break;
              }
            }
          }
          if (keyMismatch) {
            await sub.unsubscribe();
            sub = null;
          }
        }
      } catch {
        // ignore check error
      }
    }

    if (!sub) {
      const appServerKey = urlBase64ToUint8Array(keyData.publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as BufferSource,
      });
    }

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON ? sub.toJSON() : sub,
        userId: user?.id,
        userRole: user?.role,
        userName: user?.fullName,
      }),
    });

    return { ok: true, subscribed: true };
  } catch (err) {
    console.warn('Background push registration warning:', err);
    return { ok: false, subscribed: false };
  }
};

/**
 * Xin quyền Thông Báo + Tự động kích hoạt Chạy Ngầm (Web Push)
 */
export const requestNotificationPermission = async (user?: {
  id?: string;
  role?: string;
  fullName?: string;
} | null): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }
  let granted = Notification.permission === 'granted';
  if (!granted && Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    granted = permission === 'granted';
  }
  if (granted) {
    await registerBackgroundPush(user);
  }
  return granted;
};

/**
 * Gửi thử thông báo ngầm từ Server (mặc định trễ 3 giây để người dùng kịp tắt màn hình / đóng app kiểm tra)
 */
export const triggerTestBackgroundPush = async (
  senderName = 'Bếp Pro',
  delayMs = 3000
): Promise<boolean> => {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderName, delayMs }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const sendTaskNotification = (taskTitle: string, staffName: string, isCompleted: boolean) => {
  const title = isCompleted
    ? '✅ [Kitchen Log] Đầu việc hoàn tất'
    : '↩️ [Kitchen Log] Bỏ tích đầu việc';
  const body = isCompleted
    ? `${staffName} vừa tích hoàn thành: "${taskTitle}" (${new Date().toLocaleTimeString('vi-VN')})`
    : `${staffName} đã cập nhật lại: "${taskTitle}"`;

  showSystemNotification(title, body, false, `task-toggle-${Date.now()}`);
};

export const sendAssignedTaskNotification = (
  taskTitle: string,
  assignedStaffName: string,
  priority: string,
  assignedBy: string,
  isUrgent?: boolean,
  assignedByRole?: string
) => {
  const roleLabel =
    assignedByRole === 'manager'
      ? 'Trưởng Ca (@manager)'
      : assignedByRole === 'admin'
      ? 'Bếp Trưởng (@admin)'
      : assignedBy;

  const title = isUrgent
    ? `🚨 VIỆC GẤP MỚI TỪ TRƯỞNG CA: ${assignedBy}`
    : `👨‍🍳 Giao việc mới cho: ${assignedStaffName}`;
  const body = isUrgent
    ? `[TRONG NGÀY GẤP - ${priority}] "${taskTitle}" — Giao bởi ${roleLabel} cho ${assignedStaffName} lúc ${new Date().toLocaleTimeString('vi-VN')}`
    : `[${priority}] "${taskTitle}" — Giao bởi ${assignedBy} lúc ${new Date().toLocaleTimeString('vi-VN')}`;

  showSystemNotification(title, body, Boolean(isUrgent), `task-assign-${Date.now()}`);
};

export const sendDeleteRequestNotification = (requesterName: string, targetLabel: string) => {
  showSystemNotification(
    '🛡️ [Admin] Yêu cầu duyệt xóa mới',
    `${requesterName} yêu cầu xóa: "${targetLabel}". Vui lòng vào duyệt!`,
    true,
    `del-req-${Date.now()}`
  );
};

/**
 * Thông báo tự động lúc 14:30 (2h30 chiều) nhắc @manager kiểm tra checklist ca bếp
 */
export const sendManagerCheckNotification = (
  completedCount: number,
  totalCount: number,
  urgentPendingCount: number
) => {
  const pendingCount = totalCount - completedCount;
  const bodyText =
    pendingCount === 0
      ? `Đã 14:30 chiều! Toàn bộ ${totalCount}/${totalCount} công việc đã hoàn tất. @manager vui lòng nghiệm thu ca!`
      : `Đã 14:30 chiều! Tiến độ: ${completedCount}/${totalCount} việc (Còn ${pendingCount} việc chưa xong, ${urgentPendingCount} việc trong ngày gấp). @manager vui lòng kiểm tra!`;

  showSystemNotification(
    '⏰ [14:30] Nhắc @manager Kiểm Tra Checklist Bếp',
    bodyText,
    true,
    'bep-pro-1430-check'
  );
};

/**
 * Thông báo khi đầu việc Daily tự động reset sau 24h
 */
export const sendDailyResetNotification = (taskTitles: string[]) => {
  if (taskTitles.length === 0) return;

  showSystemNotification(
    '🔄 [Daily 24h] Tự động làm mới Checklist hàng ngày',
    `Đã qua 24h — Tự động reset ${taskTitles.length} đầu việc Daily: ${taskTitles.slice(0, 2).join(', ')}${
      taskTitles.length > 2 ? '...' : ''
    }`,
    false,
    'bep-pro-daily-reset'
  );
};
