/**
 * Notification and Live Cross-Tab / Cross-Device Synchronization Helper
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

export const sendTaskNotification = (taskTitle: string, staffName: string, isCompleted: boolean) => {
  // Mobile vibration
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([150, 80, 150]);
    } catch {
      // ignore
    }
  }

  // System/Phone Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const title = isCompleted ? '✅ [Kitchen Log] Đầu việc hoàn tất' : '↩️ [Kitchen Log] Bỏ tích đầu việc';
      const body = isCompleted
        ? `${staffName} vừa tích hoàn thành: "${taskTitle}" (${new Date().toLocaleTimeString('vi-VN')})`
        : `${staffName} đã cập nhật lại: "${taskTitle}"`;

      new Notification(title, {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
        silent: false,
      });
    } catch {
      // ignore
    }
  }
};

export const sendAssignedTaskNotification = (
  taskTitle: string,
  assignedStaffName: string,
  priority: string,
  assignedBy: string,
  isUrgent?: boolean,
  assignedByRole?: string
) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(
        isUrgent ? [400, 100, 400, 100, 500] : [250, 100, 250, 100, 300]
      );
    } catch {
      // ignore
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
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

      new Notification(title, {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
        silent: false,
      });
    } catch {
      // ignore
    }
  }
};

export const sendDeleteRequestNotification = (requesterName: string, targetLabel: string) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // ignore
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('🛡️ [Admin] Yêu cầu duyệt xóa mới', {
        body: `${requesterName} yêu cầu xóa: "${targetLabel}". Vui lòng vào duyệt!`,
        icon: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
        silent: false,
      });
    } catch {
      // ignore
    }
  }
};

/**
 * Thông báo tự động lúc 14:30 (2h30 chiều) nhắc @manager kiểm tra checklist ca bếp
 */
export const sendManagerCheckNotification = (
  completedCount: number,
  totalCount: number,
  urgentPendingCount: number
) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([300, 120, 300, 120, 400]);
    } catch {
      // ignore
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const pendingCount = totalCount - completedCount;
      const bodyText =
        pendingCount === 0
          ? `Đã 14:30 chiều! Toàn bộ ${totalCount}/${totalCount} công việc đã hoàn tất. @manager vui lòng nghiệm thu ca!`
          : `Đã 14:30 chiều! Tiến độ: ${completedCount}/${totalCount} việc (Còn ${pendingCount} việc chưa xong, ${urgentPendingCount} việc trong ngày gấp). @manager vui lòng kiểm tra!`;

      new Notification('⏰ [14:30] Nhắc @manager Kiểm Tra Checklist Bếp', {
        body: bodyText,
        icon: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
        silent: false,
      });
    } catch {
      // ignore
    }
  }
};

/**
 * Thông báo khi đầu việc Daily tự động reset sau 24h
 */
export const sendDailyResetNotification = (taskTitles: string[]) => {
  if (taskTitles.length === 0) return;

  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([150, 80, 150]);
    } catch {
      // ignore
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('🔄 [Daily 24h] Tự động làm mới Checklist hàng ngày', {
        body: `Đã qua 24h — Tự động reset ${taskTitles.length} đầu việc Daily: ${taskTitles.slice(0, 2).join(', ')}${
          taskTitles.length > 2 ? '...' : ''
        }`,
        icon: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
        silent: false,
      });
    } catch {
      // ignore
    }
  }
};


