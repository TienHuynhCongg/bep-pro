import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AppConfig,
  DynamicField,
  KitchenTask,
  NavItem,
  ShiftLog,
  StaffUser,
  DeleteRequest,
  DeleteTargetType,
  AppNotificationItem,
  KitchenRecipe,
  InventoryCheckItem,
  UserRole,
  canRoleAccessTab,
} from './types.ts';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_NAV_ITEMS,
  DEFAULT_SCHEMA,
  DEFAULT_TASKS,
  INITIAL_SAMPLE_LOGS,
  DEFAULT_STAFF_USERS,
  DEFAULT_RECIPES,
  DEFAULT_INVENTORY,
  DEFAULT_CUSTOM_ORDERS,
} from './defaultData.ts';
import { HeaderNav } from './components/HeaderNav.tsx';
import { ChecklistView } from './components/ChecklistView.tsx';
import { RecipeBookView } from './components/RecipeBookView.tsx';
import { InventoryCheckView } from './components/InventoryCheckView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { ChefTasksView } from './components/ChefTasksView.tsx';
import { AdminConfigView } from './components/AdminConfigView.tsx';
import { StaffManagementView } from './components/StaffManagementView.tsx';
import { CustomPageView } from './components/CustomPageView.tsx';
import { NavConfigModal } from './components/NavConfigModal.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { NotificationFeedBox } from './components/NotificationFeedBox.tsx';
import {
  sendTaskNotification,
  sendAssignedTaskNotification,
  sendDeleteRequestNotification,
  sendManagerCheckNotification,
  sendDailyResetNotification,
  registerBackgroundPush,
  requestNotificationPermission,
} from './utils/notificationSync.ts';
import {
  pushStateToServer as rawPushStateToServer,
  fetchStateFromServer,
  getClientSenderId,
  getLastSeenServerTs,
  rememberServerTs,
  ServerSyncPayload,
} from './utils/serverSync.ts';
import { CheckCircle2, AlertCircle, ShieldAlert, Check, X, BellRing } from 'lucide-react';

const STORAGE_KEYS = {
  CONFIG: 'kitchen_app_config_v2',
  NAV: 'kitchen_nav_items_v2',
  TASKS: 'kitchen_master_tasks_v2',
  SCHEMA: 'kitchen_shift_schema_v2',
  LOGS: 'kitchen_submitted_logs_v2',
  STAFF: 'kitchen_staff_users_v2',
  AUTH: 'kitchen_auth_user_v2',
  DELETE_REQUESTS: 'kitchen_delete_requests_v2',
  NOTIFICATIONS: 'kitchen_fb_notifications_v2',
  RECIPES: 'kitchen_recipes_v2',
  INVENTORY: 'kitchen_inventory_v2',
  MANAGER_1430_NOTIF_DATE: 'kitchen_manager_1430_notif_date_v2',
  MANAGER_1430_ACK_DATE: 'kitchen_manager_1430_ack_date_v2',
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const INITIAL_NOTIFICATIONS: AppNotificationItem[] = [
  {
    id: 'notif-init-1',
    actorName: 'Trưởng Ca Bếp',
    actorRole: 'manager',
    actionText: 'đã giao việc cho bạn',
    targetText: 'Kiểm tra nhiệt độ tủ đông & tủ mát đầu ca',
    createdAtMs: Date.now() - 60 * 1000, // 1p trước
    type: 'task_assigned',
  },
  {
    id: 'notif-init-2',
    actorName: 'Đầu Bếp Ca Sáng',
    actorRole: 'staff',
    actionText: 'đã hoàn thành việc',
    targetText: 'Vệ sinh thớt & khử khuẩn khu sơ chế',
    createdAtMs: Date.now() - 3 * 60 * 1000, // 3p trước
    type: 'task_completed',
  },
];

function ensureLatestNavItems(list: NavItem[]): NavItem[] {
  const labelMap: Record<string, string> = {
    'Checklist Nhân Viên': 'Checklist',
    'Lưu Công Thức': 'Công Thức',
    'Lưu Tồn Kiểm': 'Tồn Kiểm',
    'Lịch Sử Ca': 'Lịch Sử',
    'Thống Kê Ca': 'Thống Kê',
    'Giao Việc Bếp Trưởng': 'Giao Việc',
    'Quản Lý Nhân Sự': 'Nhân Sự',
    'Cấu Hình Admin': 'Cấu Hình',
  };

  const cloned = list.map((item) => ({
    ...item,
    label: labelMap[item.label] || item.label,
  }));

  if (!cloned.some((i) => i.targetType === 'recipes')) {
    const recipeNav: NavItem = {
      id: 'nav-recipes',
      label: 'Công Thức',
      iconName: 'BookOpen',
      targetType: 'recipes',
      visible: true,
      colorTheme: 'amber',
    };
    const checklistIdx = cloned.findIndex((i) => i.targetType === 'checklist');
    if (checklistIdx >= 0) cloned.splice(checklistIdx + 1, 0, recipeNav);
    else cloned.unshift(recipeNav);
  }
  if (!cloned.some((i) => i.targetType === 'inventory')) {
    const invNav: NavItem = {
      id: 'nav-inventory',
      label: 'Tồn Kiểm',
      iconName: 'PackageCheck',
      targetType: 'inventory',
      visible: true,
      colorTheme: 'emerald',
    };
    const recipeIdx = cloned.findIndex((i) => i.targetType === 'recipes');
    if (recipeIdx >= 0) cloned.splice(recipeIdx + 1, 0, invNav);
    else cloned.push(invNav);
  }
  if (!cloned.some((i) => i.targetType === 'chef_tasks')) {
    const chefItem: NavItem = {
      id: 'nav-chef-tasks',
      label: 'Giao Việc',
      iconName: 'ChefHat',
      targetType: 'chef_tasks',
      visible: true,
      colorTheme: 'amber',
    };
    const adminIdx = cloned.findIndex((i) => i.targetType === 'admin');
    if (adminIdx >= 0) cloned.splice(adminIdx, 0, chefItem);
    else cloned.push(chefItem);
  }
  return cloned;
}

export default function App() {
  // App Branding Config
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      return saved ? JSON.parse(saved) : DEFAULT_APP_CONFIG;
    } catch {
      return DEFAULT_APP_CONFIG;
    }
  });

  // Nav Items (Configurable toolbar)
  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NAV);
      if (saved) {
        const parsed: NavItem[] = JSON.parse(saved);
        return ensureLatestNavItems(parsed);
      }
      return DEFAULT_NAV_ITEMS;
    } catch {
      return DEFAULT_NAV_ITEMS;
    }
  });

  // Master Tasks
  const [tasks, setTasks] = useState<KitchenTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      return saved ? JSON.parse(saved) : DEFAULT_TASKS;
    } catch {
      return DEFAULT_TASKS;
    }
  });

  // Dynamic Shift Fields Schema
  const [schema, setSchema] = useState<DynamicField[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEMA);
      return saved ? JSON.parse(saved) : DEFAULT_SCHEMA;
    } catch {
      return DEFAULT_SCHEMA;
    }
  });

  // Submitted Shift Logs
  const [logs, setLogs] = useState<ShiftLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      return saved ? JSON.parse(saved) : INITIAL_SAMPLE_LOGS;
    } catch {
      return INITIAL_SAMPLE_LOGS;
    }
  });

  // Staff Personnel List
  const [staffList, setStaffList] = useState<StaffUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STAFF);
      return saved ? JSON.parse(saved) : DEFAULT_STAFF_USERS;
    } catch {
      return DEFAULT_STAFF_USERS;
    }
  });

  // Current Logged-in User (Persists in localStorage across phone app restarts)
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Delete Requests (Manager -> Admin approval queue)
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DELETE_REQUESTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Facebook-style Notification Feed (Hiển thị số phút đã trôi qua, bấm vào để xóa)
  const [notifications, setNotifications] = useState<AppNotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  // 1. Lưu Công Thức Món Ăn (Recipes)
  const [recipes, setRecipes] = useState<KitchenRecipe[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECIPES);
      return saved ? JSON.parse(saved) : DEFAULT_RECIPES;
    } catch {
      return DEFAULT_RECIPES;
    }
  });

  // 2. Lưu Số Lượng Tồn Kiểm (Inventory Check)
  const [inventory, setInventory] = useState<InventoryCheckItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      return saved ? JSON.parse(saved) : DEFAULT_INVENTORY;
    } catch {
      return DEFAULT_INVENTORY;
    }
  });

  // Keep latest state refs to avoid stale closures in SSE / BroadcastChannel / timers
  const currentUserRef = useRef<StaffUser | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        registerBackgroundPush(currentUser);
      } else if (Notification.permission === 'default') {
        const timer = setTimeout(() => {
          requestNotificationPermission(currentUser);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser]);

  const tasksRef = useRef<KitchenTask[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const staffListRef = useRef<StaffUser[]>(staffList);
  useEffect(() => {
    staffListRef.current = staffList;
  }, [staffList]);

  const notificationsRef = useRef<AppNotificationItem[]>(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const appConfigRef = useRef<AppConfig>(appConfig);
  useEffect(() => {
    appConfigRef.current = appConfig;
  }, [appConfig]);

  // Login Modal state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  const [serverConnected, setServerConnected] = useState<boolean>(false);

  // Active Tab (ghi nhớ trang đang mở: nếu có reload thì chỉ tải lại đúng trang đó, không quay về trang chính)
  const [activeTabId, setActiveTabIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('kitchen_active_tab_v2') || 'nav-checklist';
    } catch {
      return 'nav-checklist';
    }
  });
  const setActiveTabId = (id: string) => {
    setActiveTabIdState(id);
    try {
      localStorage.setItem('kitchen_active_tab_v2', id);
    } catch {
      // ignore
    }
  };

  // Trạng thái tự động mở danh sách đặt hàng khi bấm từ HeaderNav
  const [autoOpenOrderList, setAutoOpenOrderList] = useState<boolean>(false);

  // Tính số lượng mặt hàng cần đặt cho tất cả các role
  const lowStockOrdersCount = useMemo(() => {
    const lowStockInv = inventory.filter((item) => {
      const stock = parseFloat(item.stockQty);
      const threshold = item.minThreshold ?? 3;
      return !isNaN(stock) && stock <= threshold;
    }).length;
    let customCount = 0;
    try {
      const raw = localStorage.getItem('kitchen_custom_orders');
      if (raw) {
        customCount = JSON.parse(raw).length;
      } else {
        customCount = DEFAULT_CUSTOM_ORDERS.length;
      }
    } catch {
      customCount = DEFAULT_CUSTOM_ORDERS.length;
    }
    return lowStockInv + customCount;
  }, [inventory]);

  // Handler mở nhanh danh sách đặt hàng từ bất cứ trang nào
  const handleOpenOrderList = () => {
    const invTab = navItems.find((n) => n.targetType === 'inventory' && n.visible);
    if (invTab) {
      setActiveTabId(invTab.id);
    }
    setAutoOpenOrderList(true);
  };

  // Quick Nav Config Modal
  const [showNavConfigModal, setShowNavConfigModal] = useState<boolean>(false);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Trạng thái nhắc @manager kiểm tra lúc 14:30 chiều
  const [manager1430AlertActive, setManager1430AlertActive] = useState<boolean>(() => {
    try {
      const todayStr = new Date().toLocaleDateString('vi-VN');
      const notifiedDate = localStorage.getItem(STORAGE_KEYS.MANAGER_1430_NOTIF_DATE);
      const ackDate = localStorage.getItem(STORAGE_KEYS.MANAGER_1430_ACK_DATE);
      return notifiedDate === todayStr && ackDate !== todayStr;
    } catch {
      return false;
    }
  });

  // Trạng thái thông báo nổi khi Trưởng Ca (@manager / @admin) giao việc gấp mới
  const [urgentManagerTaskAlert, setUrgentManagerTaskAlert] = useState<{
    taskTitle: string;
    assignedBy: string;
    assignedByRole?: string;
    time: string;
  } | null>(null);

  // Save to LocalStorage effects
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffList));
    } catch {
      // ignore
    }
  }, [staffList]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DELETE_REQUESTS, JSON.stringify(deleteRequests));
    } catch {
      // ignore
    }
  }, [deleteRequests]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(recipes));
    } catch {
      // ignore
    }
  }, [recipes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
    } catch {
      // ignore
    }
  }, [inventory]);

  // Role-based route protection: if current activeTab is not allowed for user role, redirect to first allowed tab
  useEffect(() => {
    if (!currentUser) return; // Chưa đăng nhập: giữ nguyên trang đã ghi nhớ
    const activeItem = navItems.find((item) => item.id === activeTabId);
    if (!activeItem || !canRoleAccessTab(currentUser?.role, activeItem.targetType, activeItem)) {
      const firstAllowed = navItems.find(
        (item) => item.visible && canRoleAccessTab(currentUser?.role, item.targetType, item)
      );
      if (firstAllowed) {
        setActiveTabId(firstAllowed.id);
      }
    }
  }, [currentUser, activeTabId, navItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(appConfig));
    } catch {
      // ignore
    }
  }, [appConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NAV, JSON.stringify(navItems));
    } catch {
      // ignore
    }
  }, [navItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify(schema));
    } catch {
      // ignore
    }
  }, [schema]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch {
      // ignore
    }
  }, [logs]);

  // Show Toast Helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Tự động sao lưu dữ liệu mỗi khi Admin thao tác
  const pushStateToServer = (payload: ServerSyncPayload) => {
    const role = currentUserRef.current?.role || 'staff';
    const name = currentUserRef.current?.fullName || 'User';

    if (role === 'admin') {
      try {
        const clientBackup = {
          timestamp: Date.now(),
          adminName: name,
          tasks: payload.tasks || tasksRef.current,
          staffList: payload.staffList || staffListRef.current,
          appConfig: payload.appConfig || appConfigRef.current,
          toolbarItems: payload.toolbarItems || navItems,
          inventory: payload.inventory || inventory,
          recipes: payload.recipes || recipes,
        };
        localStorage.setItem('kitchen_admin_auto_backup_latest', JSON.stringify(clientBackup));
      } catch {
        // ignore
      }
    }

    return rawPushStateToServer({
      ...payload,
      senderRole: role,
      senderName: name,
    });
  };

  // Helper: Thêm thông báo kiểu Facebook vào Ô thông báo & đồng bộ
  const createNotificationItem = (
    payload: Omit<AppNotificationItem, 'id' | 'createdAtMs'>
  ): AppNotificationItem[] => {
    const newItem: AppNotificationItem = {
      ...payload,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAtMs: Date.now(),
    };
    const nextList = [newItem, ...notificationsRef.current].slice(0, 40);
    notificationsRef.current = nextList;
    setNotifications(nextList);
    return nextList;
  };

  // Nhấp vào thông báo để xóa ngay lập tức
  const handleDeleteNotification = (id: string) => {
    const nextList = notificationsRef.current.filter((n) => n.id !== id);
    notificationsRef.current = nextList;
    setNotifications(nextList);
    pushStateToServer({ notifications: nextList });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'NOTIFICATIONS_UPDATED',
          notifications: nextList,
        });
        channel.close();
      } catch {
        // ignore
      }
    }
  };

  const handleClearAllNotifications = () => {
    notificationsRef.current = [];
    setNotifications([]);
    pushStateToServer({ notifications: [] });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'NOTIFICATIONS_UPDATED',
          notifications: [],
        });
        channel.close();
      } catch {
        // ignore
      }
    }
  };

  // 1. Tự động Reset các đầu việc Daily sau 24h kể từ lúc tích hoàn thành
  useEffect(() => {
    const checkDaily24hReset = () => {
      const now = Date.now();
      const currentTasks = tasksRef.current;
      let hasChanges = false;
      const resetTitles: string[] = [];

      const updated = currentTasks.map((t) => {
        const isDaily = (t.taskType || 'daily') === 'daily';
        if (isDaily && t.completed && t.completedTimestamp && now - t.completedTimestamp >= TWENTY_FOUR_HOURS_MS) {
          hasChanges = true;
          resetTitles.push(t.title);
          return {
            ...t,
            completed: false,
            completedAt: undefined,
            completedTimestamp: undefined,
            completedBy: undefined,
            completedById: undefined,
            completedByRole: undefined,
          };
        }
        return t;
      });

      if (hasChanges) {
        tasksRef.current = updated;
        setTasks(updated);
        const nextNotifs = createNotificationItem({
          actorName: 'Hệ Thống Bếp',
          actorRole: 'admin',
          actionText: `đã tự động reset ${resetTitles.length} việc Daily sau 24h:`,
          targetText: resetTitles.join(', '),
          type: 'system',
        });
        pushStateToServer({ tasks: updated, notifications: nextNotifs });

        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
            channel.postMessage({
              type: 'TASKS_UPDATED',
              tasks: updated,
              notifications: nextNotifs,
            });
            channel.close();
          } catch {
            // ignore
          }
        }

        sendDailyResetNotification(resetTitles);
        showToast(`Đã tự động reset ${resetTitles.length} đầu việc Daily sau 24h!`);
      }
    };

    checkDaily24hReset();
    const interval = setInterval(checkDaily24hReset, 30000);
    return () => clearInterval(interval);
  }, []);

  // Hàm phát thông báo nhắc @manager kiểm tra lúc 14:30 chiều
  const triggerManager1430Check = () => {
    const todayStr = new Date().toLocaleDateString('vi-VN');
    try {
      localStorage.setItem(STORAGE_KEYS.MANAGER_1430_NOTIF_DATE, todayStr);
      localStorage.removeItem(STORAGE_KEYS.MANAGER_1430_ACK_DATE);
    } catch {
      // ignore
    }
    setManager1430AlertActive(true);

    const currentTasks = tasksRef.current;
    const completedCount = currentTasks.filter((t) => t.completed).length;
    const totalCount = currentTasks.length;
    const urgentPendingCount = currentTasks.filter(
      (t) => !t.completed && (t.taskType === 'urgent_today' || t.priority === 'Gấp' || t.priority === 'Tối khẩn')
    ).length;

    const nextNotifs = createNotificationItem({
      actorName: 'Lịch Kiểm Tra 14:30',
      actorRole: 'manager',
      actionText: 'nhắc @manager kiểm tra tiến độ Checklist ca bếp',
      targetText: `Hoàn thành ${completedCount}/${totalCount} việc`,
      type: 'system',
    });

    if (currentUserRef.current?.role === 'manager' || currentUserRef.current?.role === 'admin') {
      sendManagerCheckNotification(completedCount, totalCount, urgentPendingCount);
      showToast(
        `⏰ [14:30] Nhắc @manager kiểm tra Checklist! (${completedCount}/${totalCount} việc đã xong)`
      );
    }

    pushStateToServer({
      notifications: nextNotifs,
      notification: {
        kind: 'MANAGER_1430_CHECK',
        completedCount,
        totalCount,
        urgentPendingCount,
      },
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'MANAGER_1430_CHECK',
          completedCount,
          totalCount,
          urgentPendingCount,
          notifications: nextNotifs,
        });
        channel.close();
      } catch {
        // ignore
      }
    }
  };

  // 2. Hẹn giờ tự động gửi thông báo lúc 14:30 (2h30 chiều) hàng ngày cho @manager kiểm tra
  useEffect(() => {
    const check1430Schedule = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const todayStr = now.toLocaleDateString('vi-VN');

      if (hours === 14 && minutes >= 30) {
        const lastNotifiedDate = localStorage.getItem(STORAGE_KEYS.MANAGER_1430_NOTIF_DATE);
        if (lastNotifiedDate !== todayStr) {
          triggerManager1430Check();
        }
      }
    };

    check1430Schedule();
    const timer = setInterval(check1430Schedule, 15000);
    return () => clearInterval(timer);
  }, []);

  // 3. Hàm phát chuông thông báo nhắc việc chưa làm sau mỗi 1h
  const triggerHourlyReminder = async () => {
    const currentTasks = tasksRef.current;
    const totalCount = currentTasks.length;
    const completedCount = currentTasks.filter((t) => t.completed).length;
    const pendingCount = Math.max(totalCount - completedCount, 0);
    const nowHour = new Date().getHours();

    const notifItem = {
      actorName: `Nhắc Việc ${nowHour}:00`,
      actorRole: 'manager' as const,
      actionText: `thông báo còn ${pendingCount} việc chưa làm`,
      targetText: `Tiến độ: ${completedCount}/${totalCount} việc`,
      type: 'task_urgent' as const,
    };
    const nextNotifs = createNotificationItem(notifItem);

    showToast(`⏰ [${nowHour}:00] Còn ${pendingCount} việc chưa làm!`);

    // Gửi qua Server Push & SSE để mọi thiết bị (kể cả đã tắt/kill app) đều nhận chuông
    try {
      await fetch('/api/push/test-hourly', { method: 'POST' });
    } catch {
      pushStateToServer({
        notifications: nextNotifs,
      });
    }
  };

  // Tự động kiểm tra nhắc việc chưa làm sau mỗi 1h (ví dụ 9h nhắc còn việc = việc giao - việc đã làm)
  useEffect(() => {
    const checkHourlySchedule = () => {
      const now = new Date();
      const hour = now.getHours();
      const todayStr = now.toLocaleDateString('vi-VN');
      const reminderKey = `hourly_notif_${todayStr}_${hour}`;

      const config = appConfigRef.current || {};
      const reminderEnabled = config.hourlyReminderEnabled !== false;
      const startHour = typeof config.hourlyReminderStartHour === 'number' ? config.hourlyReminderStartHour : 8;
      const endHour = typeof config.hourlyReminderEndHour === 'number' ? config.hourlyReminderEndHour : 22;

      if (!reminderEnabled) return;
      if (hour < startHour || hour > endHour) return;

      const alreadyNotified = localStorage.getItem(reminderKey);
      if (!alreadyNotified) {
        localStorage.setItem(reminderKey, 'true');
        const currentTasks = tasksRef.current;
        const total = currentTasks.length;
        const completed = currentTasks.filter((t) => t.completed).length;
        const pending = Math.max(total - completed, 0);

        if (total > 0 && pending > 0) {
          triggerHourlyReminder();
        }
      }
    };

    checkHourlySchedule();
    const hourlyTimer = setInterval(checkHourlySchedule, 20000);
    return () => clearInterval(hourlyTimer);
  }, []);

  // Real-time Server Synchronization (Cross-Device iOS & Android via /api/events SSE + /api/state)
  // Chạy 1 lần duy nhất khi mở app để kết nối siêu tốc và không ghi đè state khi đổi user
  useEffect(() => {
    let eventSource: EventSource | null = null;

    fetchStateFromServer().then((res) => {
      if (res.ok && res.state) {
        setServerConnected(true);
        const s = res.state;
        const isServerInitialized = Boolean(
          s.initialized ||
            (Array.isArray(s.tasks) && s.tasks.length > 0) ||
            (Array.isArray(s.logs) && s.logs.length > 0) ||
            (Array.isArray(s.staffList) && s.staffList.length > 0)
        );
        const serverTs = s.updatedAt || 0;
        const lastSeenTs = getLastSeenServerTs();
        // Server bị reset về bản cũ (VD: sau khi deploy bản mới) -> máy này đẩy dữ liệu mới nhất của mình lên khôi phục
        const serverRolledBack = isServerInitialized && lastSeenTs > 0 && serverTs + 1000 < lastSeenTs;

        if (isServerInitialized && !serverRolledBack) {
          rememberServerTs(serverTs);
          if (Array.isArray(s.tasks)) {
            tasksRef.current = s.tasks;
            setTasks(s.tasks);
          }
          if (Array.isArray(s.logs)) setLogs(s.logs);
          if (Array.isArray(s.staffList) && s.staffList.length > 0) {
            staffListRef.current = s.staffList;
            setStaffList(s.staffList);
          }
          if (Array.isArray(s.toolbarItems) && s.toolbarItems.length > 0) {
            setNavItems(ensureLatestNavItems(s.toolbarItems));
          }
          if (Array.isArray(s.deleteRequests)) setDeleteRequests(s.deleteRequests);
          if (Array.isArray(s.notifications) && s.notifications.length > 0) {
            notificationsRef.current = s.notifications;
            setNotifications(s.notifications);
          }
          if (Array.isArray(s.recipes)) setRecipes(s.recipes);
          if (Array.isArray(s.inventory)) setInventory(s.inventory);
          if (s.appConfig && typeof s.appConfig === 'object') setAppConfig(s.appConfig);
        } else {
          // Server mới tinh hoặc vừa bị reset: khôi phục từ dữ liệu cục bộ trên máy này
          pushStateToServer({
            tasks: tasksRef.current,
            logs,
            staffList: staffListRef.current,
            toolbarItems: navItems,
            deleteRequests,
            notifications: notificationsRef.current,
            recipes,
            inventory,
            appConfig,
          });
        }
      }
    });

    try {
      eventSource = new EventSource('/api/events');
      eventSource.onopen = () => setServerConnected(true);
      eventSource.onerror = () => setServerConnected(false);
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'STATE_UPDATED' && data.senderId !== getClientSenderId()) {
            const s = data.state;
            if (s) {
              rememberServerTs(s.updatedAt);
              if (s.appConfig && typeof s.appConfig === 'object') setAppConfig(s.appConfig);
              if (Array.isArray(s.tasks)) {
                tasksRef.current = s.tasks;
                setTasks(s.tasks);
              }
              if (Array.isArray(s.logs)) setLogs(s.logs);
              if (Array.isArray(s.staffList) && s.staffList.length > 0) {
                staffListRef.current = s.staffList;
                setStaffList(s.staffList);
              }
              if (Array.isArray(s.toolbarItems) && s.toolbarItems.length > 0) {
                setNavItems(ensureLatestNavItems(s.toolbarItems));
              }
              if (Array.isArray(s.deleteRequests)) setDeleteRequests(s.deleteRequests);
              if (Array.isArray(s.notifications)) {
                notificationsRef.current = s.notifications;
                setNotifications(s.notifications);
              }
              if (Array.isArray(s.recipes)) setRecipes(s.recipes);
              if (Array.isArray(s.inventory)) setInventory(s.inventory);
            }

            const notif = data.notification;
            if (notif) {
              // Hiển thị thông báo khi @admin hoặc @manager giao việc
              if (
                notif.kind === 'TASK_ASSIGNED' &&
                notif.taskTitle &&
                (notif.assignedByRole === 'manager' || notif.assignedByRole === 'admin')
              ) {
                const assignedName = notif.assignedStaffName || 'Toàn bộ ca';
                const roleLabel = notif.assignedByRole === 'admin' ? 'Bếp Trưởng' : 'Trưởng Ca';
                const isUrgentNotif =
                  notif.isUrgent || notif.priority === 'Gấp' || notif.priority === 'Tối khẩn';
                if (isUrgentNotif) {
                  setUrgentManagerTaskAlert({
                    taskTitle: notif.taskTitle,
                    assignedBy: notif.assignedBy || roleLabel,
                    assignedByRole: notif.assignedByRole || 'manager',
                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  });
                  showToast(`🚨 Việc gấp từ ${notif.assignedBy || roleLabel}: "${notif.taskTitle}"`);
                } else {
                  showToast(`👨‍🍳 Việc mới cho ${assignedName}: "${notif.taskTitle}"`);
                }
                sendAssignedTaskNotification(
                  notif.taskTitle,
                  assignedName,
                  notif.priority || 'Thường',
                  notif.assignedBy || roleLabel,
                  isUrgentNotif,
                  notif.assignedByRole
                );
              } else if (notif.kind === 'MANAGER_1430_CHECK') {
                setManager1430AlertActive(true);
                const role = currentUserRef.current?.role;
                if (role === 'manager' || role === 'admin') {
                  sendManagerCheckNotification(
                    notif.completedCount ?? 0,
                    notif.totalCount ?? 0,
                    notif.urgentPendingCount ?? 0
                  );
                  showToast('⏰ [14:30] Nhắc @manager kiểm tra tiến độ Checklist ca bếp!');
                }
              }
            }
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BADGE' });
        }
        fetchStateFromServer().then((res) => {
          if (res.ok && res.state) {
            const s = res.state;
            const lastSeenTs = getLastSeenServerTs();
            if (lastSeenTs > 0 && (s.updatedAt || 0) + 1000 < lastSeenTs) {
              // Server vừa bị reset về bản cũ: tải lại trang hiện tại để khôi phục toàn bộ dữ liệu từ máy này lên server
              window.location.reload();
              return;
            }
            rememberServerTs(s.updatedAt);
            if (s.appConfig && typeof s.appConfig === 'object') setAppConfig(s.appConfig);
            if (Array.isArray(s.tasks)) {
              tasksRef.current = s.tasks;
              setTasks(s.tasks);
            }
            if (Array.isArray(s.logs)) setLogs(s.logs);
            if (Array.isArray(s.staffList) && s.staffList.length > 0) {
              staffListRef.current = s.staffList;
              setStaffList(s.staffList);
            }
            if (Array.isArray(s.notifications)) {
              notificationsRef.current = s.notifications;
              setNotifications(s.notifications);
            }
            if (Array.isArray(s.recipes)) setRecipes(s.recipes);
            if (Array.isArray(s.inventory)) setInventory(s.inventory);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      eventSource?.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Real-time synchronization across browser tabs and devices via BroadcastChannel & storage events
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.onmessage = (event) => {
          if (Array.isArray(event.data?.notifications)) {
            notificationsRef.current = event.data.notifications;
            setNotifications(event.data.notifications);
          }

          if (event.data?.type === 'TASKS_UPDATED' && Array.isArray(event.data.tasks)) {
            tasksRef.current = event.data.tasks;
            setTasks(event.data.tasks);
          } else if (event.data?.type === 'TASK_ASSIGNED' && Array.isArray(event.data.tasks)) {
            tasksRef.current = event.data.tasks;
            setTasks(event.data.tasks);
            if (event.data.assignedByRole === 'manager' || event.data.assignedByRole === 'admin') {
              const assignedName = event.data.assignedStaffName || 'Toàn bộ ca';
              const roleLabel = event.data.assignedByRole === 'admin' ? 'Bếp Trưởng' : 'Trưởng Ca';
              const isUrgentNotif =
                event.data.isUrgent || event.data.priority === 'Gấp' || event.data.priority === 'Tối khẩn';
              if (isUrgentNotif) {
                setUrgentManagerTaskAlert({
                  taskTitle: event.data.taskTitle,
                  assignedBy: event.data.assignedBy || roleLabel,
                  assignedByRole: event.data.assignedByRole || 'manager',
                  time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                });
                showToast(`🚨 Việc gấp từ ${event.data.assignedBy || roleLabel}: "${event.data.taskTitle}"`);
              } else {
                showToast(`👨‍🍳 Việc mới cho ${assignedName}: "${event.data.taskTitle}"`);
              }
              sendAssignedTaskNotification(
                event.data.taskTitle,
                assignedName,
                event.data.priority || 'Thường',
                event.data.assignedBy || roleLabel,
                isUrgentNotif,
                event.data.assignedByRole
              );
            }
          } else if (event.data?.type === 'DELETE_REQUEST_UPDATED' && Array.isArray(event.data.requests)) {
            setDeleteRequests(event.data.requests);
          } else if (event.data?.type === 'CONFIG_UPDATED' && event.data.appConfig) {
            setAppConfig(event.data.appConfig);
          } else if (event.data?.type === 'STAFF_UPDATED' && Array.isArray(event.data.staffList)) {
            staffListRef.current = event.data.staffList;
            setStaffList(event.data.staffList);
          } else if (event.data?.type === 'MANAGER_1430_CHECK') {
            setManager1430AlertActive(true);
            const role = currentUserRef.current?.role;
            if (role === 'manager' || role === 'admin') {
              sendManagerCheckNotification(
                event.data.completedCount ?? 0,
                event.data.totalCount ?? 0,
                event.data.urgentPendingCount ?? 0
              );
              showToast('⏰ [14:30] Nhắc @manager kiểm tra tiến độ Checklist ca bếp!');
            }
          }
        };
      } catch {
        // ignore
      }
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TASKS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          tasksRef.current = parsed;
          setTasks(parsed);
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_KEYS.CONFIG && e.newValue) {
        try {
          setAppConfig(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_KEYS.STAFF && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          staffListRef.current = parsed;
          setStaffList(parsed);
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_KEYS.DELETE_REQUESTS && e.newValue) {
        try {
          setDeleteRequests(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_KEYS.LOGS && e.newValue) {
        try {
          setLogs(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_KEYS.NOTIFICATIONS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          notificationsRef.current = parsed;
          setNotifications(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Helper: Tạo yêu cầu xóa khi người thao tác không phải Admin (ví dụ: Quản lý / Trưởng ca)
  const createDeleteRequest = (targetType: DeleteTargetType, targetLabel: string, targetId?: string) => {
    const requesterName = currentUser?.fullName || 'Quản Lý Ca';
    const requesterRole = currentUser?.role || 'manager';

    const alreadyExists = deleteRequests.some(
      (r) => r.status === 'pending' && r.targetType === targetType && r.targetId === targetId
    );
    if (alreadyExists) {
      showToast('⏳ Yêu cầu xóa mục này đã được gửi và đang chờ Admin duyệt!', 'error');
      return;
    }

    const newReq: DeleteRequest = {
      id: `DEL-${Date.now().toString().slice(-5)}`,
      targetType,
      targetId,
      targetLabel,
      requestedBy: requesterName,
      requestedByRole: requesterRole,
      requestedAt: new Date().toLocaleString('vi-VN'),
      status: 'pending',
    };

    const updatedRequests = [newReq, ...deleteRequests];
    setDeleteRequests(updatedRequests);

    const nextNotifs = createNotificationItem({
      actorName: requesterName,
      actorRole: requesterRole,
      actionText: 'đã gửi yêu cầu xóa',
      targetText: targetLabel,
      type: 'system',
    });

    pushStateToServer({
      deleteRequests: updatedRequests,
      notifications: nextNotifs,
      notification: {
        kind: 'DELETE_REQUEST',
        requesterName,
        newRequestLabel: targetLabel,
      },
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'DELETE_REQUEST_UPDATED',
          requests: updatedRequests,
          newRequestLabel: targetLabel,
          requesterName,
          notifications: nextNotifs,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    showToast(`📨 Đã gửi yêu cầu xóa "${targetLabel}" cho Admin phê duyệt!`);
  };

  // Admin Duyệt Yêu Cầu Xóa
  const handleApproveDeleteRequest = (reqId: string) => {
    if (currentUser?.role !== 'admin') {
      showToast('Chỉ Bếp Trưởng (Admin) mới có quyền duyệt xóa!', 'error');
      return;
    }

    const req = deleteRequests.find((r) => r.id === reqId);
    if (!req) return;

    let nextLogs = logs;
    let nextStaff = staffList;
    let nextNav = navItems;

    if (req.targetType === 'log_single' && req.targetId) {
      nextLogs = logs.filter((l) => l.id !== req.targetId);
      setLogs(nextLogs);
    } else if (req.targetType === 'log_all') {
      nextLogs = [];
      setLogs([]);
    } else if (req.targetType === 'staff' && req.targetId) {
      nextStaff = staffList.filter((s) => s.id !== req.targetId);
      setStaffList(nextStaff);
    } else if (req.targetType === 'nav_item' && req.targetId) {
      nextNav = navItems.filter((i) => i.id !== req.targetId);
      setNavItems(nextNav);
    }

    const updated = deleteRequests.filter((r) => r.id !== reqId);
    setDeleteRequests(updated);
    pushStateToServer({
      logs: nextLogs,
      staffList: nextStaff,
      toolbarItems: nextNav,
      deleteRequests: updated,
    });
    showToast(`✅ Admin đã duyệt và xóa: "${req.targetLabel}"`);
  };

  // Admin Từ Chối Yêu Cầu Xóa
  const handleRejectDeleteRequest = (reqId: string) => {
    if (currentUser?.role !== 'admin') {
      showToast('Chỉ Bếp Trưởng (Admin) mới có quyền từ chối!', 'error');
      return;
    }

    const req = deleteRequests.find((r) => r.id === reqId);
    const updated = deleteRequests.filter((r) => r.id !== reqId);
    setDeleteRequests(updated);
    pushStateToServer({ deleteRequests: updated });
    if (req) {
      showToast(`❌ Đã từ chối yêu cầu xóa "${req.targetLabel}" của ${req.requestedBy}`);
    }
  };

  // Task Actions with Live Synchronization & Facebook-style Notification Feed
  const handleToggleTask = (taskId: string) => {
    const currentTasks = tasksRef.current;
    const existingTask = currentTasks.find((t) => t.id === taskId);
    if (!existingTask) return;

    const staffName = currentUser ? currentUser.fullName : 'Đầu Bếp Ca Trực';
    const staffId = currentUser?.id;
    const staffRole = currentUser ? currentUser.role : 'staff';

    if (existingTask.completed) {
      const isSameOwner =
        (existingTask.completedById && staffId && existingTask.completedById === staffId) ||
        existingTask.completedBy === staffName ||
        currentUser?.role === 'admin';

      if (!isSameOwner) {
        showToast(
          `🔒 Đầu việc này do "${existingTask.completedBy || 'Đầu bếp ca trực'}" thực hiện, người khác không được tích lại!`,
          'error'
        );
        return;
      }
    } else {
      if (
        existingTask.assignedStaffId &&
        currentUser?.id !== existingTask.assignedStaffId &&
        currentUser?.role !== 'admin'
      ) {
        showToast(
          `⚠️ Việc này được chỉ định riêng cho "${existingTask.assignedStaffName}", bạn không thể tích thay!`,
          'error'
        );
        return;
      }
    }

    const nowTime = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const willComplete = !existingTask.completed;
    const toggledTaskTitle = existingTask.title;

    const updated = currentTasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          completed: willComplete,
          completedAt: willComplete ? `${nowTime}, ${new Date().toLocaleDateString('vi-VN')}` : undefined,
          completedTimestamp: willComplete ? Date.now() : undefined,
          completedBy: willComplete ? staffName : undefined,
          completedById: willComplete ? staffId : undefined,
          completedByRole: willComplete ? staffRole : undefined,
        };
      }
      return t;
    });

    tasksRef.current = updated;
    setTasks(updated);

    // Thêm vào Ô thông báo kiểu Facebook (VD: "B đã hoàn thành việc ... Vừa xong / 1p trước")
    const nextNotifs = createNotificationItem({
      actorName: staffName,
      actorRole: staffRole,
      actionText: willComplete ? 'đã hoàn thành việc' : 'đã mở lại việc',
      targetText: toggledTaskTitle,
      type: 'task_completed',
    });

    pushStateToServer({
      tasks: updated,
      notifications: nextNotifs,
      notification: {
        kind: 'TASK_TOGGLED',
        taskTitle: toggledTaskTitle,
        staffName,
        isCompleted: willComplete,
      },
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'TASKS_UPDATED',
          tasks: updated,
          notifications: nextNotifs,
          staffName,
          taskTitle: toggledTaskTitle,
          isCompleted: willComplete,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    if (willComplete) {
      showToast(`✅ ${staffName} đã hoàn thành: "${toggledTaskTitle}"`);
    } else {
      showToast(`↩️ ${staffName} đã bỏ tích: "${toggledTaskTitle}"`);
    }
  };

  // Manual & Auto Refresh
  const handleRefreshTasks = () => {
    fetchStateFromServer().then((res) => {
      if (res.ok && res.state && Array.isArray(res.state.tasks)) {
        tasksRef.current = res.state.tasks;
        setTasks(res.state.tasks);
        if (Array.isArray(res.state.notifications)) {
          notificationsRef.current = res.state.notifications;
          setNotifications(res.state.notifications);
        }
        showToast('Đã đồng bộ danh sách việc mới nhất từ Server!');
        return;
      }
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
        if (saved) {
          const parsed = JSON.parse(saved);
          tasksRef.current = parsed;
          setTasks(parsed);
        }
        showToast('Đã cập nhật lại danh sách việc mới nhất!');
      } catch {
        // ignore
      }
    });
  };

  const handleResetTasks = () => {
    if (currentUser?.role !== 'admin') {
      showToast('Chỉ Bếp Trưởng (Admin) mới có quyền làm mới toàn bộ tích ca!', 'error');
      return;
    }

    const updated = tasksRef.current.map((t) => ({
      ...t,
      completed: false,
      completedAt: undefined,
      completedTimestamp: undefined,
      completedBy: undefined,
      completedById: undefined,
      completedByRole: undefined,
    }));

    tasksRef.current = updated;
    setTasks(updated);

    const actorName = currentUser?.fullName || 'Bếp Trưởng (Admin)';
    const nextNotifs = createNotificationItem({
      actorName,
      actorRole: 'admin',
      actionText: 'đã làm mới (Reset) toàn bộ Checklist ca bếp',
      type: 'system',
    });

    pushStateToServer({ tasks: updated, notifications: nextNotifs });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'TASKS_UPDATED',
          tasks: updated,
          notifications: nextNotifs,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    showToast('Đã làm mới danh sách việc ca này!');
  };

  const handleAddTask = (newTask: Omit<KitchenTask, 'id' | 'completed'>) => {
    const trimmedTitle = (newTask.title || '').trim();
    if (!trimmedTitle) {
      showToast('Vui lòng nhập nội dung công việc!', 'error');
      return;
    }

    const nowShort = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const assignedBy = newTask.createdBy || currentUser?.fullName || 'Trưởng Ca';
    const assignedByRole = newTask.createdByRole || currentUser?.role || 'manager';

    const task: KitchenTask = {
      ...newTask,
      title: trimmedTitle,
      taskType: newTask.taskType || 'daily',
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      completed: false,
      createdBy: assignedBy,
      createdByRole: assignedByRole,
      createdAt: newTask.createdAt || nowShort,
    };

    const assignedTargetName = task.assignedStaffName || 'Toàn bộ ca bếp';
    const isUrgent =
      task.taskType === 'urgent_today' || task.priority === 'Gấp' || task.priority === 'Tối khẩn';

    // Chỉ hiện cảnh báo nổi khi Trưởng Ca (@manager) giao việc gấp (không hiện của admin)
    if (isUrgent && assignedByRole === 'manager') {
      setUrgentManagerTaskAlert({
        taskTitle: task.title,
        assignedBy,
        assignedByRole,
        time: nowShort,
      });
    }

    const updated = [task, ...tasksRef.current];
    tasksRef.current = updated;
    setTasks(updated);

    // Thêm vào Ô thông báo kiểu Facebook (VD: "A đã giao việc cho bạn 1p trước")
    const actionText = isUrgent
      ? task.assignedStaffName
        ? `đã giao VIỆC GẤP cho ${task.assignedStaffName}`
        : 'đã giao việc gấp cho bạn'
      : task.assignedStaffName
      ? `đã giao việc cho ${task.assignedStaffName}`
      : 'đã giao việc cho bạn';

    const nextNotifs = createNotificationItem({
      actorName: assignedBy,
      actorRole: assignedByRole,
      actionText,
      targetText: task.title,
      type: isUrgent ? 'task_urgent' : 'task_assigned',
    });

    pushStateToServer({
      tasks: updated,
      notifications: nextNotifs,
      notification: {
        kind: 'TASK_ASSIGNED',
        taskTitle: task.title,
        assignedStaffName: assignedTargetName,
        priority: task.priority,
        assignedBy,
        assignedByRole,
        isUrgent,
      },
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'TASK_ASSIGNED',
          tasks: updated,
          notifications: nextNotifs,
          taskTitle: task.title,
          assignedStaffId: task.assignedStaffId,
          assignedStaffName: assignedTargetName,
          priority: task.priority,
          assignedBy,
          assignedByRole,
          isUrgent,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    sendAssignedTaskNotification(
      task.title,
      assignedTargetName,
      task.priority,
      assignedBy,
      isUrgent,
      assignedByRole
    );

    if (isUrgent) {
      showToast(`🚨 Đã giao VIỆC GẤP mới ("${task.title}") & phát thông báo khẩn!`);
    } else if (task.assignedStaffName) {
      showToast(`📲 Đã giao việc cho ${task.assignedStaffName}!`);
    } else {
      showToast('📲 Đã thêm đầu việc mới cho ca bếp!');
    }
  };

  // Cập nhật / chỉnh sửa đầu việc (dành cho Trưởng Ca @manager & Admin @admin)
  const handleUpdateTask = (updatedTask: KitchenTask) => {
    const trimmedTitle = (updatedTask.title || '').trim();
    if (!trimmedTitle) {
      showToast('Tên đầu việc không được để trống!', 'error');
      return;
    }

    const cleanTask: KitchenTask = {
      ...updatedTask,
      title: trimmedTitle,
    };

    const nowShort = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const assignedBy = currentUser?.fullName || cleanTask.createdBy || 'Trưởng Ca';
    const assignedByRole = currentUser?.role || cleanTask.createdByRole || 'manager';
    const isUrgent =
      cleanTask.taskType === 'urgent_today' ||
      cleanTask.priority === 'Gấp' ||
      cleanTask.priority === 'Tối khẩn';

    // Chỉ hiện cảnh báo nổi khi Trưởng Ca (@manager) giao việc gấp (không hiện của admin)
    if (isUrgent && assignedByRole === 'manager') {
      setUrgentManagerTaskAlert({
        taskTitle: cleanTask.title,
        assignedBy,
        assignedByRole,
        time: nowShort,
      });
    }

    const next = tasksRef.current.map((t) => (t.id === cleanTask.id ? cleanTask : t));
    tasksRef.current = next;
    setTasks(next);

    const nextNotifs = createNotificationItem({
      actorName: assignedBy,
      actorRole: assignedByRole,
      actionText: isUrgent ? 'đã cập nhật thành VIỆC GẤP' : 'đã chỉnh sửa đầu việc',
      targetText: cleanTask.title,
      type: isUrgent ? 'task_urgent' : 'task_assigned',
    });

    pushStateToServer({
      tasks: next,
      notifications: nextNotifs,
      notification: isUrgent
        ? {
            kind: 'TASK_ASSIGNED',
            taskTitle: cleanTask.title,
            assignedStaffName: cleanTask.assignedStaffName || 'Toàn bộ ca bếp',
            priority: cleanTask.priority,
            assignedBy,
            assignedByRole,
            isUrgent: true,
          }
        : undefined,
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: isUrgent ? 'TASK_ASSIGNED' : 'TASKS_UPDATED',
          tasks: next,
          notifications: nextNotifs,
          taskTitle: cleanTask.title,
          assignedStaffName: cleanTask.assignedStaffName || 'Toàn bộ ca bếp',
          priority: cleanTask.priority,
          assignedBy,
          assignedByRole,
          isUrgent,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    if (isUrgent) {
      sendAssignedTaskNotification(
        cleanTask.title,
        cleanTask.assignedStaffName || 'Toàn bộ ca bếp',
        cleanTask.priority,
        assignedBy,
        true,
        assignedByRole
      );
      showToast(`🚨 Đã cập nhật thành VIỆC GẤP: "${cleanTask.title}"`);
    } else {
      showToast(`✅ Đã cập nhật đầu việc: "${cleanTask.title}"`);
    }
  };

  // Xóa trực tiếp đầu việc trong Checklist / Giao Việc (không dùng window.confirm gây đơ trên đt)
  const handleDeleteTask = (id: string) => {
    const target = tasksRef.current.find((t) => t.id === id);
    const updated = tasksRef.current.filter((t) => t.id !== id);
    tasksRef.current = updated;
    setTasks(updated);
    pushStateToServer({ tasks: updated });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'TASKS_UPDATED',
          tasks: updated,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    showToast(target ? `Đã xóa việc: "${target.title}"` : 'Đã xóa đầu việc');
  };

  const handleClearAllTasks = () => {
    tasksRef.current = [];
    setTasks([]);
    pushStateToServer({ tasks: [] });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'TASKS_UPDATED',
          tasks: [],
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    showToast('Đã dọn dẹp toàn bộ danh sách việc giao');
  };

  const handleLoadTaskPreset = (type: 'standard' | 'haccp' | 'bakery') => {
    if (type === 'standard') {
      tasksRef.current = DEFAULT_TASKS;
      setTasks(DEFAULT_TASKS);
      pushStateToServer({ tasks: DEFAULT_TASKS });
      showToast('Đã nạp mẫu Bếp Tiêu Chuẩn!');
    } else if (type === 'haccp') {
      const haccpTasks: KitchenTask[] = [
        { id: 'h1', title: 'Đo & ghi nhiệt độ tủ cấp đông sâu (< -18°C)', category: 'An toàn ATTP', priority: 'Gấp', taskType: 'daily', completed: false, assignedShift: 'Tất cả ca' },
        { id: 'h2', title: 'Đo & ghi nhiệt độ tủ mát bảo quản thịt cá (< 4°C)', category: 'An toàn ATTP', priority: 'Gấp', taskType: 'daily', completed: false, assignedShift: 'Tất cả ca' },
        { id: 'h3', title: 'Khử khuẩn thớt màu (Đỏ: thịt sống, Xanh: rau, Trắng: đồ chín)', category: 'An toàn ATTP', priority: 'Gấp', taskType: 'daily', completed: false, assignedShift: 'Tất cả ca' },
        { id: 'h4', title: 'Kiểm tra tem nhãn NSX, HSD và bọc màng thực phẩm chuẩn FIFO', category: 'Kiểm kê', priority: 'Thường', taskType: 'daily', completed: false, assignedShift: 'Ca Sáng' },
        { id: 'h5', title: 'Vệ sinh bẫy mỡ inox và khử trùng bồn rửa bát', category: 'Vệ sinh', priority: 'Thường', taskType: 'daily', completed: false, assignedShift: 'Ca Chiều' },
        { id: 'h6', title: 'Nghiệm thu rác hữu cơ đóng kín & khóa van an toàn hệ thống gas', category: 'An toàn ATTP', priority: 'Tối khẩn', taskType: 'urgent_today', completed: false, assignedShift: 'Tất cả ca' },
      ];
      tasksRef.current = haccpTasks;
      setTasks(haccpTasks);
      pushStateToServer({ tasks: haccpTasks });
      showToast('Đã nạp mẫu Vệ Sinh An Toàn HACCP!');
    }
  };

  // Staff Personnel Actions
  const handleAddStaff = (newStaff: Omit<StaffUser, 'id'>, autoLogin?: boolean) => {
    const trimmedName = (newStaff.fullName || '').trim();
    if (!trimmedName) {
      showToast('Vui lòng nhập họ tên nhân sự!', 'error');
      return;
    }

    // BẢO MẬT TUYỆT ĐỐI:
    // - Khi tự đăng ký tài khoản mới (autoLogin === true): Luôn luôn gán role 'staff' (Nhân viên).
    // - Chỉ Admin đang thao tác trong trang Quản Lý Nhân Sự (autoLogin !== true) mới được chỉ định admin/manager.
    const effectiveRole: UserRole =
      autoLogin ? 'staff' : (currentUser?.role === 'admin' ? newStaff.role || 'staff' : 'staff');

    const staff: StaffUser = {
      ...newStaff,
      fullName: trimmedName,
      role: effectiveRole,
      status: 'active',
      lastLogin: autoLogin ? new Date().toLocaleString('vi-VN') : newStaff.lastLogin,
      id: `staff-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    const updated = [...staffListRef.current, staff];
    staffListRef.current = updated;
    setStaffList(updated);

    if (autoLogin) {
      setCurrentUser(staff);
    }

    const nextNotifs = createNotificationItem({
      actorName: staff.fullName,
      actorRole: staff.role,
      actionText: 'vừa đăng ký tài khoản nhân sự mới',
      targetText: `@${staff.username} • ${staff.station || 'Ca bếp'}`,
      type: 'system',
    });

    pushStateToServer({ staffList: updated, notifications: nextNotifs });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'STAFF_UPDATED',
          staffList: updated,
          notifications: nextNotifs,
          newStaffName: `${staff.fullName} (@${staff.username})`,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    showToast(
      autoLogin
        ? `🎉 Đăng ký & đăng nhập thành công: ${staff.fullName} (@${staff.username})`
        : `Đã thêm nhân sự mới: ${staff.fullName} (@${staff.username})`
    );
  };

  const handleUpdateStaff = (updated: StaffUser) => {
    const next = staffListRef.current.map((s) => (s.id === updated.id ? updated : s));
    staffListRef.current = next;
    setStaffList(next);
    pushStateToServer({ staffList: next });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'STAFF_UPDATED',
          staffList: next,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    if (currentUser?.id === updated.id) {
      setCurrentUser(updated);
    }
    showToast(`Đã cập nhật thông tin: ${updated.fullName}`);
  };

  const handleDeleteStaff = (id: string) => {
    const target = staffListRef.current.find((s) => s.id === id);
    if (currentUser?.role !== 'admin') {
      createDeleteRequest('staff', `Nhân sự: ${target?.fullName || id}`, id);
      return;
    }
    const next = staffListRef.current.filter((s) => s.id !== id);
    staffListRef.current = next;
    setStaffList(next);
    pushStateToServer({ staffList: next });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'STAFF_UPDATED',
          staffList: next,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    if (currentUser?.id === id) {
      setCurrentUser(next[0] || null);
    }
    showToast('Đã xóa tài khoản nhân sự');
  };

  const handleSwitchUser = (user: StaffUser) => {
    setCurrentUser(user);
    showToast(`Đã chuyển sang tài khoản: ${user.fullName}`);
  };

  const handleLogin = (user: StaffUser) => {
    const updated: StaffUser = {
      ...user,
      status: 'active' as const,
      lastLogin: new Date().toLocaleString('vi-VN'),
    };
    setCurrentUser(updated);
    const exists = staffListRef.current.some((s) => s.id === user.id || s.username === user.username);
    const next = exists
      ? staffListRef.current.map((s) => (s.id === user.id || s.username === user.username ? updated : s))
      : [...staffListRef.current, updated];
    staffListRef.current = next;
    setStaffList(next);
    pushStateToServer({ staffList: next });
    showToast(`Xin chào ${updated.fullName}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    showToast('Đã đăng xuất tài khoản.');
  };

  // Submit Shift Log
  const handleSubmitShift = (logData: Omit<ShiftLog, 'id' | 'timestamp'>) => {
    const newLog: ShiftLog = {
      ...logData,
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleString('vi-VN'),
    };
    const updated = [newLog, ...logs];
    setLogs(updated);

    const nextNotifs = createNotificationItem({
      actorName: logData.staffName || currentUser?.fullName || 'Nhân viên ca',
      actorRole: currentUser?.role || 'staff',
      actionText: `đã nộp biên bản bàn giao ${logData.shiftName}`,
      targetText: `${logData.completedCount}/${logData.totalCount} việc hoàn tất`,
      type: 'task_completed',
    });

    pushStateToServer({ logs: updated, notifications: nextNotifs });
    showToast('🎉 Đã nộp báo cáo ca bếp thành công!');

    const historyItem = navItems.find((item) => item.targetType === 'history' && item.visible);
    if (historyItem) {
      setActiveTabId(historyItem.id);
    }
  };

  // Log Actions
  const handleDeleteLog = (id: string) => {
    if (currentUser?.role === 'admin') {
      const updated = logs.filter((l) => l.id !== id);
      setLogs(updated);
      pushStateToServer({ logs: updated });
      showToast('Đã xóa báo cáo ca');
    } else if (currentUser?.role === 'manager') {
      const targetLog = logs.find((l) => l.id === id);
      createDeleteRequest(
        'log_single',
        `Báo cáo ca ${id} (${targetLog?.staffName || ''} - ${targetLog?.dateStr || ''})`,
        id
      );
    } else {
      showToast('Bạn không có quyền xóa lịch sử báo cáo!', 'error');
    }
  };

  const handleClearAllLogs = () => {
    if (currentUser?.role === 'admin') {
      setLogs([]);
      pushStateToServer({ logs: [] });
      showToast('Đã xóa toàn bộ lịch sử ca');
    } else if (currentUser?.role === 'manager') {
      createDeleteRequest('log_all', `Toàn bộ lịch sử báo cáo ca (${logs.length} báo cáo)`);
    } else {
      showToast('Bạn không có quyền xóa lịch sử báo cáo!', 'error');
    }
  };

  // CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('Chưa có dữ liệu để xuất file!', 'error');
      return;
    }

    const headers = ['Mã Báo Cáo', 'Thời Gian Gửi', 'Đầu Bếp / Trưởng Ca', 'Ca Làm', 'Tỷ Lệ Hoàn Thành', 'Chi Tiết Đầu Việc', 'Thông Tin Ca'];
    const rows = logs.map((log) => {
      const taskSummary = log.tasks
        .map((t) => `${t.completed ? '[X]' : '[ ]'} ${t.title} (${t.category})`)
        .join(' | ');
      const fieldSummary = log.fields.map((f) => `${f.label}: ${f.value}`).join(' | ');
      const rate = `${log.completedCount}/${log.totalCount} (${Math.round((log.completedCount / (log.totalCount || 1)) * 100)}%)`;

      return [
        `"${log.id}"`,
        `"${log.timestamp}"`,
        `"${log.staffName}"`,
        `"${log.shiftName}"`,
        `"${rate}"`,
        `"${taskSummary.replace(/"/g, '""')}"`,
        `"${fieldSummary.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Ca_Bep_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất file Excel (CSV) thành công!');
  };

  // 1. Handlers Lưu Công Thức (Recipes) - Chỉ Trưởng Ca (@manager) & Bếp Trưởng (@admin) được thêm/sửa/xóa
  const handleSaveRecipe = (recipePayload: KitchenRecipe, isEdit: boolean) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
      showToast('Nhân viên chỉ được xem công thức, không có quyền chỉnh sửa!', 'error');
      return;
    }
    const nextRecipes = isEdit
      ? recipes.map((r) => (r.id === recipePayload.id ? recipePayload : r))
      : [recipePayload, ...recipes];
    setRecipes(nextRecipes);

    const actorName = currentUser?.fullName || 'Bếp Trưởng';
    const nextNotifs = createNotificationItem({
      actorName,
      actorRole: currentUser?.role || 'manager',
      actionText: isEdit ? 'đã cập nhật công thức món' : 'đã lưu công thức mới',
      targetText: recipePayload.dishName,
      type: 'task_completed',
    });

    pushStateToServer({ recipes: nextRecipes, notifications: nextNotifs });
    showToast(
      isEdit
        ? `✅ Đã cập nhật công thức: "${recipePayload.dishName}"`
        : `📖 Đã lưu công thức món: "${recipePayload.dishName}"`
    );
  };

  const handleDeleteRecipe = (id: string) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
      showToast('Nhân viên chỉ được xem công thức, không có quyền xóa!', 'error');
      return;
    }
    const target = recipes.find((r) => r.id === id);
    const nextRecipes = recipes.filter((r) => r.id !== id);
    setRecipes(nextRecipes);
    pushStateToServer({ recipes: nextRecipes });
    showToast(target ? `Đã xóa công thức: "${target.dishName}"` : 'Đã xóa công thức');
  };

  // 2. Handlers Lưu Số Lượng Tồn Kiểm (Inventory Check - Sửa trực tiếp trong bảng, Lưu theo ngày, Chỉ Admin được xóa)
  const handleSaveInventoryItem = (itemPayload: InventoryCheckItem, isEdit: boolean) => {
    const exists = inventory.some((i) => i.id === itemPayload.id);
    const nextInventory =
      isEdit && exists
        ? inventory.map((i) => (i.id === itemPayload.id ? itemPayload : i))
        : [...inventory, itemPayload];
    setInventory(nextInventory);

    // Không thông báo về các thao tác chỉnh sửa trực tiếp từng ô của nhân viên và admin
    // Dữ liệu được đồng bộ ngầm lên Server, không tạo thông báo cho đến khi người dùng bấm Lưu
    pushStateToServer({ inventory: nextInventory });
  };

  const handleSaveDailyInventoryTable = (
    dateStr: string,
    updatedAllItems: InventoryCheckItem[]
  ) => {
    setInventory(updatedAllItems);
    const countForDate = updatedAllItems.filter((i) => i.dateStr === dateStr).length;
    const actorName = currentUser?.fullName || 'Nhân viên ca';

    const nextNotifs = createNotificationItem({
      actorName,
      actorRole: currentUser?.role || 'staff',
      actionText: `đã lưu bảng tồn kiểm ngày ${dateStr}`,
      targetText: `${countForDate} mặt hàng trong bảng`,
      type: 'task_completed',
    });

    pushStateToServer({ inventory: updatedAllItems, notifications: nextNotifs });
    showToast(`📦 Đã lưu bảng tồn kiểm ngày ${dateStr} (${countForDate} dòng)!`);
  };

  const handleDeleteInventoryItem = (id: string) => {
    if (currentUser?.role !== 'admin') {
      showToast('🔒 Chỉ Bếp Trưởng (Admin) mới có quyền xóa dữ liệu trong bảng tồn kiểm!', 'error');
      return;
    }
    const target = inventory.find((i) => i.id === id);
    const nextInventory = inventory.filter((i) => i.id !== id);
    setInventory(nextInventory);
    pushStateToServer({ inventory: nextInventory });
    showToast(target?.itemName ? `Đã xóa dòng tồn kiểm: "${target.itemName}"` : 'Đã xóa dòng trong bảng');
  };

  const handleDeleteInventoryDateTable = (dateStr: string) => {
    if (currentUser?.role !== 'admin') {
      showToast('🔒 Chỉ Bếp Trưởng (Admin) mới có quyền xóa bảng tồn kiểm theo ngày!', 'error');
      return;
    }
    const nextInventory = inventory.filter((i) => i.dateStr !== dateStr);
    setInventory(nextInventory);
    pushStateToServer({ inventory: nextInventory });
    showToast(`🗑️ Admin đã xóa bảng tồn kiểm ngày ${dateStr}`);
  };

  // Find currently active nav item
  const currentNavItem = navItems.find((item) => item.id === activeTabId) || navItems[0];
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const urgentPendingCount = tasks.filter(
    (t) => !t.completed && (t.taskType === 'urgent_today' || t.priority === 'Gấp' || t.priority === 'Tối khẩn')
  ).length;
  const pendingDeleteRequests = deleteRequests.filter((r) => r.status === 'pending');

  const handleAcknowledgeManager1430 = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.MANAGER_1430_ACK_DATE, new Date().toLocaleDateString('vi-VN'));
    } catch {
      // ignore
    }
    setManager1430AlertActive(false);
    showToast('✅ Đã xác nhận @manager hoàn tất kiểm tra Checklist lúc 14:30!');
  };

  return (
    <div className="fixed inset-0 h-dvh w-full overflow-hidden bg-zinc-100 text-zinc-900 flex flex-col font-sans antialiased selection:bg-zinc-900 selection:text-white">
      {/* Top Frame: Cố định trên cùng, tự động chừa khoảng trống dưới tai thỏ iPhone (pt-safe-top) */}
      <HeaderNav
        config={appConfig}
        navItems={navItems}
        activeTabId={activeTabId}
        onSelectTab={(id) => setActiveTabId(id)}
        onOpenNavConfig={() => setShowNavConfigModal(true)}
        pendingTasksCount={pendingTasksCount}
        totalLogsCount={logs.length}
        currentUser={currentUser}
        onOpenLogin={() => setShowLoginModal(true)}
        notifications={notifications}
        onDeleteNotification={handleDeleteNotification}
        onClearAllNotifications={handleClearAllNotifications}
        serverConnected={serverConnected}
        onOpenOrderList={handleOpenOrderList}
        lowStockOrdersCount={lowStockOrdersCount}
      />

      {/* Middle Scrollable Frame: Toàn bộ nội dung cuộn mượt bên trong khung giữa, không bao giờ tràn lên tai thỏ hay đè xuống thanh menu đáy */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain flex flex-col">
        {/* Global Urgent Task Notification Banner (Khi Trưởng Ca giao việc gấp mới) */}
        {urgentManagerTaskAlert && (
          <div className="max-w-5xl w-full mx-auto px-3 sm:px-6 pt-3">
            <div className="bg-rose-600 text-white rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm">
                <div className="p-2 bg-white/15 text-white rounded-xl shrink-0">
                  <BellRing className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-rose-900/50 text-white font-mono font-bold text-[10px] uppercase">
                      VIỆC GẤP MỚI • {urgentManagerTaskAlert.time}
                    </span>
                    <span className="font-semibold text-rose-100 text-xs">
                      Từ: {urgentManagerTaskAlert.assignedBy}
                    </span>
                  </div>
                  <p className="text-white font-bold text-sm sm:text-base mt-0.5">
                    &ldquo;{urgentManagerTaskAlert.taskTitle}&rdquo;
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {currentNavItem?.targetType !== 'checklist' && (
                  <button
                    onClick={() => {
                      const checklistTab = navItems.find((i) => i.targetType === 'checklist');
                      if (checklistTab) setActiveTabId(checklistTab.id);
                      setUrgentManagerTaskAlert(null);
                    }}
                    className="h-8 px-3 bg-white text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition"
                  >
                    Mở Checklist
                  </button>
                )}
                <button
                  onClick={() => setUrgentManagerTaskAlert(null)}
                  className="h-8 px-3 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã xem</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global 14:30 PM Notification Banner for @manager (and @admin) */}
        {manager1430AlertActive && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
          <div className="max-w-5xl w-full mx-auto px-3 sm:px-6 pt-3">
            <div className="bg-zinc-900 text-white border border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm">
                <div className="p-2 bg-amber-500 text-zinc-950 rounded-xl shrink-0">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
                      14:30 CHIỀU • @manager
                    </span>
                    <span className="font-bold text-white">
                      Kiểm tra tiến độ Checklist ca bếp
                    </span>
                  </div>
                  <p className="text-zinc-300 text-xs mt-0.5">
                    Đã xong <strong>{completedTasksCount}/{tasks.length}</strong> việc
                    {urgentPendingCount > 0 ? (
                      <span className="text-rose-400 font-semibold">
                        {' '}• Còn {urgentPendingCount} việc gấp chưa xong!
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold"> • Không còn việc gấp tồn đọng.</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={handleAcknowledgeManager1430}
                  className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã kiểm tra</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Admin Approval Banner */}
        {currentUser?.role === 'admin' && pendingDeleteRequests.length > 0 && currentNavItem?.targetType !== 'history' && (
          <div className="max-w-5xl w-full mx-auto px-3 sm:px-6 pt-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-950">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Yêu cầu xóa chờ duyệt ({pendingDeleteRequests.length}): </span>
                  <span className="text-rose-700 font-semibold">{pendingDeleteRequests[0].targetLabel}</span>
                  <span className="text-zinc-500 text-xs"> ({pendingDeleteRequests[0].requestedBy})</span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => handleRejectDeleteRequest(pendingDeleteRequests[0].id)}
                  className="h-8 px-3 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Từ chối</span>
                </button>
                <button
                  onClick={() => handleApproveDeleteRequest(pendingDeleteRequests[0].id)}
                  className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Duyệt xóa</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-grow max-w-5xl w-full mx-auto px-3 sm:px-6 py-3.5 sm:py-5 space-y-3.5">
          {/* Render View based on targetType of active Tab with role-based permission verification */}
          {currentNavItem && canRoleAccessTab(currentUser?.role, currentNavItem.targetType, currentNavItem) ? (
            <>
              {currentNavItem.targetType === 'checklist' && (
                <ChecklistView
                  tasks={tasks}
                  onToggleTask={handleToggleTask}
                  onResetTasks={handleResetTasks}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onRefreshTasks={handleRefreshTasks}
                  onSubmitShift={handleSubmitShift}
                  currentUser={currentUser}
                  staffList={staffList}
                  onSwitchUser={handleSwitchUser}
                />
              )}

              {currentNavItem.targetType === 'recipes' && (
                <RecipeBookView
                  recipes={recipes}
                  onSaveRecipe={handleSaveRecipe}
                  onDeleteRecipe={handleDeleteRecipe}
                  currentUser={currentUser}
                />
              )}

              {currentNavItem.targetType === 'inventory' && (
                <InventoryCheckView
                  items={inventory}
                  onSaveItem={handleSaveInventoryItem}
                  onDeleteItem={handleDeleteInventoryItem}
                  onSaveDailyTable={handleSaveDailyInventoryTable}
                  onDeleteDateTable={handleDeleteInventoryDateTable}
                  currentUser={currentUser}
                  recipes={recipes}
                  initialOpenOrderList={autoOpenOrderList}
                  onCloseOrderListModal={() => setAutoOpenOrderList(false)}
                />
              )}

              {currentNavItem.targetType === 'history' && (
                <HistoryView
                  logs={logs}
                  onDeleteLog={handleDeleteLog}
                  onClearAllLogs={handleClearAllLogs}
                  onExportCSV={handleExportCSV}
                  currentUser={currentUser}
                  deleteRequests={deleteRequests}
                  onApproveDeleteRequest={handleApproveDeleteRequest}
                  onRejectDeleteRequest={handleRejectDeleteRequest}
                />
              )}

              {currentNavItem.targetType === 'analytics' && (
                <AnalyticsView logs={logs} />
              )}

              {currentNavItem.targetType === 'staff' && (
                <StaffManagementView
                  staffList={staffList}
                  currentUser={currentUser}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onDeleteStaff={handleDeleteStaff}
                  onSwitchUser={handleSwitchUser}
                  logs={logs}
                />
              )}

              {currentNavItem.targetType === 'chef_tasks' && (
                <ChefTasksView
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onResetTasks={handleResetTasks}
                  onClearAllTasks={handleClearAllTasks}
                  onLoadTaskPreset={handleLoadTaskPreset}
                  staffList={staffList}
                  currentUser={currentUser}
                  onTriggerManager1430Check={triggerManager1430Check}
                  onTriggerHourlyCheck={triggerHourlyReminder}
                />
              )}

              {currentNavItem.targetType === 'admin' && (
                <AdminConfigView
                  appConfig={appConfig}
                  onUpdateAppConfig={(cfg) => {
                    setAppConfig(cfg);
                    pushStateToServer({ appConfig: cfg });
                    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                      try {
                        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
                        channel.postMessage({ type: 'CONFIG_UPDATED', appConfig: cfg });
                        channel.close();
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  navItems={navItems}
                  onUpdateNavItems={(items) => {
                    setNavItems(items);
                    pushStateToServer({ toolbarItems: items });
                  }}
                  onRestoreFullDatabase={(restored) => {
                    if (restored.tasks && Array.isArray(restored.tasks)) setTasks(restored.tasks);
                    if (restored.logs && Array.isArray(restored.logs)) setLogs(restored.logs);
                    if (restored.staffList && Array.isArray(restored.staffList)) setStaffList(restored.staffList);
                    if (restored.recipes && Array.isArray(restored.recipes)) setRecipes(restored.recipes);
                    if (restored.inventory && Array.isArray(restored.inventory)) setInventory(restored.inventory);
                    if (restored.appConfig && typeof restored.appConfig === 'object') setAppConfig(restored.appConfig);
                    if (restored.toolbarItems && Array.isArray(restored.toolbarItems)) setNavItems(restored.toolbarItems);
                    pushStateToServer(restored);
                    showToast('Khôi phục toàn bộ dữ liệu thành công!');
                  }}
                />
              )}

              {currentNavItem.targetType === 'custom' && (
                <CustomPageView
                  navItem={currentNavItem}
                  onUpdateNavItem={(updated) => {
                    setNavItems((prev) => {
                      const next = prev.map((i) => (i.id === updated.id ? updated : i));
                      pushStateToServer({ toolbarItems: next });
                      return next;
                    });
                    showToast('Đã lưu nội dung trang tùy chỉnh!');
                  }}
                />
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-zinc-200/80 shadow-xs max-w-md mx-auto my-10 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Khu Vực Giới Hạn Quyền Truy Cập
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Tài khoản ({currentUser ? currentUser.fullName : 'Chưa đăng nhập'}) không có quyền mở trang này.
                </p>
              </div>
              <button
                onClick={() => {
                  const firstAllowed = navItems.find((i) => i.visible && canRoleAccessTab(currentUser?.role, i.targetType, i));
                  if (firstAllowed) setActiveTabId(firstAllowed.id);
                }}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition"
              >
                Về Checklist Ca Bếp
              </button>
            </div>
          )}
        </main>

        {/* Minimalist Production Footer */}
        <footer className="bg-white text-zinc-400 text-[11px] py-3 border-t border-zinc-200/80 text-center shrink-0">
          <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1.5">
            <p>© {new Date().getFullYear()} {appConfig.appTitle} • Hệ Thống Vận Hành Bếp</p>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => {
                  const adminItem = navItems.find((i) => i.targetType === 'admin');
                  if (adminItem) {
                    setActiveTabId(adminItem.id);
                  }
                }}
                className="text-zinc-600 hover:text-zinc-900 font-semibold transition"
              >
                Cấu hình hệ thống (Admin)
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Bottom Frame: Cố định ở đáy khung ứng dụng (md:hidden), không bao giờ đè lên nội dung */}
      <MobileBottomNav
        navItems={navItems}
        activeTabId={activeTabId}
        onSelectTab={(id) => setActiveTabId(id)}
        onOpenNavConfig={() => setShowNavConfigModal(true)}
        pendingTasksCount={pendingTasksCount}
        totalLogsCount={logs.length}
        currentUser={currentUser}
      />

      {/* Quick Nav Config Modal */}
      <NavConfigModal
        isOpen={showNavConfigModal}
        onClose={() => setShowNavConfigModal(false)}
        navItems={navItems}
        onUpdateNavItems={(items) => {
          setNavItems(items);
          pushStateToServer({ toolbarItems: items });
          showToast('Đã cập nhật thanh công cụ!');
        }}
        onOpenFullAdmin={() => {
          const adminItem = navItems.find((i) => i.targetType === 'admin');
          if (adminItem) {
            setActiveTabId(adminItem.id);
          }
        }}
      />

      {/* Login & Switch User Modal (Mandatory when currentUser is null) */}
      <LoginModal
        isOpen={showLoginModal || !currentUser}
        onClose={() => setShowLoginModal(false)}
        staffList={staffList}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onRegisterStaff={handleAddStaff}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-5 right-3 md:right-5 left-3 sm:left-auto z-50 px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2.5 transition-all duration-200 border ${
            toast.type === 'error'
              ? 'bg-rose-950 text-white border-rose-800'
              : 'bg-zinc-900 text-white border-zinc-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
