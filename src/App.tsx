import React, { useState, useEffect } from 'react';
import {
  AppConfig,
  DynamicField,
  KitchenTask,
  NavItem,
  ShiftLog,
  StaffUser,
  DeleteRequest,
  DeleteTargetType,
  canRoleAccessTab,
} from './types.ts';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_NAV_ITEMS,
  DEFAULT_SCHEMA,
  DEFAULT_TASKS,
  INITIAL_SAMPLE_LOGS,
  DEFAULT_STAFF_USERS,
} from './defaultData.ts';
import { HeaderNav } from './components/HeaderNav.tsx';
import { ChecklistView } from './components/ChecklistView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { ChefTasksView } from './components/ChefTasksView.tsx';
import { AdminConfigView } from './components/AdminConfigView.tsx';
import { StaffManagementView } from './components/StaffManagementView.tsx';
import { CustomPageView } from './components/CustomPageView.tsx';
import { NavConfigModal } from './components/NavConfigModal.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import {
  sendTaskNotification,
  sendAssignedTaskNotification,
  sendDeleteRequestNotification,
  sendManagerCheckNotification,
  sendDailyResetNotification,
} from './utils/notificationSync.ts';
import {
  pushStateToServer,
  fetchStateFromServer,
  getClientSenderId,
} from './utils/serverSync.ts';
import { CheckCircle2, AlertCircle, ShieldAlert, Check, X, BellRing, Clock } from 'lucide-react';

const STORAGE_KEYS = {
  CONFIG: 'kitchen_app_config_v2',
  NAV: 'kitchen_nav_items_v2',
  TASKS: 'kitchen_master_tasks_v2',
  SCHEMA: 'kitchen_shift_schema_v2',
  LOGS: 'kitchen_submitted_logs_v2',
  STAFF: 'kitchen_staff_users_v2',
  AUTH: 'kitchen_auth_user_v2',
  DELETE_REQUESTS: 'kitchen_delete_requests_v2',
  MANAGER_1430_NOTIF_DATE: 'kitchen_manager_1430_notif_date_v2',
  MANAGER_1430_ACK_DATE: 'kitchen_manager_1430_ack_date_v2',
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

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
        if (!parsed.some((i) => i.targetType === 'chef_tasks')) {
          const chefItem: NavItem = {
            id: 'nav-chef-tasks',
            label: 'Giao Việc Bếp Trưởng',
            iconName: 'ChefHat',
            targetType: 'chef_tasks',
            visible: true,
            colorTheme: 'amber',
          };
          const adminIdx = parsed.findIndex((i) => i.targetType === 'admin');
          if (adminIdx >= 0) {
            parsed.splice(adminIdx, 0, chefItem);
          } else {
            parsed.push(chefItem);
          }
        }
        return parsed;
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

  // Current Logged-in User (Starts at null if not logged in, and persists across phone app restarts once logged in)
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

  // Login Modal state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  const [serverConnected, setServerConnected] = useState<boolean>(false);

  // Active Tab
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return 'nav-checklist';
  });

  // Admin Sub-tab router
  const [adminInitialSubTab, setAdminInitialSubTab] = useState<'nav' | 'tasks' | 'schema'>('nav');

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
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffList));
  }, [staffList]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DELETE_REQUESTS, JSON.stringify(deleteRequests));
  }, [deleteRequests]);

  // Role-based route protection: if current activeTab is not allowed for user role, redirect to first allowed tab
  useEffect(() => {
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

  // Save to LocalStorage effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(appConfig));
  }, [appConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NAV, JSON.stringify(navItems));
  }, [navItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  // 1. Tự động Reset các đầu việc Daily sau 24h kể từ lúc tích hoàn thành
  useEffect(() => {
    const checkDaily24hReset = () => {
      const now = Date.now();
      const resetTitles: string[] = [];

      setTasks((prev) => {
        let hasChanges = false;
        const updated = prev.map((t) => {
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
          return updated;
        }
        return prev;
      });

      if (resetTitles.length > 0) {
        sendDailyResetNotification(resetTitles);
        showToast(`Đã tự động reset ${resetTitles.length} đầu việc Daily sau 24h!`);
      }
    };

    checkDaily24hReset();
    const interval = setInterval(checkDaily24hReset, 30000); // Kiểm tra mỗi 30 giây
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

    const completedCount = tasks.filter((t) => t.completed).length;
    const totalCount = tasks.length;
    const urgentPendingCount = tasks.filter(
      (t) => !t.completed && (t.taskType === 'urgent_today' || t.priority === 'Gấp' || t.priority === 'Tối khẩn')
    ).length;

    if (currentUser?.role === 'manager' || currentUser?.role === 'admin') {
      sendManagerCheckNotification(completedCount, totalCount, urgentPendingCount);
      showToast(
        `⏰ [14:30] Nhắc @manager kiểm tra Checklist! (${completedCount}/${totalCount} việc đã xong)`
      );
    }

    pushStateToServer({
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
  }, [tasks, currentUser]);

  // Real-time Server Synchronization (Cross-Device iOS & Android via /api/events SSE + /api/state)
  useEffect(() => {
    let eventSource: EventSource | null = null;

    // Initial state sync with backend server
    fetchStateFromServer().then((res) => {
      if (res.ok && res.state) {
        setServerConnected(true);
        const s = res.state;
        const hasServerData = Array.isArray(s.tasks) && s.tasks.length > 0;
        if (hasServerData) {
          if (Array.isArray(s.tasks)) setTasks(s.tasks);
          if (Array.isArray(s.logs)) setLogs(s.logs);
          if (Array.isArray(s.staffList)) setStaffList(s.staffList);
          if (Array.isArray(s.toolbarItems)) setNavItems(s.toolbarItems);
          if (Array.isArray(s.deleteRequests)) setDeleteRequests(s.deleteRequests);
        } else {
          // Seed server with initial local data if server is fresh
          pushStateToServer({
            tasks,
            logs,
            staffList,
            toolbarItems: navItems,
            deleteRequests,
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
              if (Array.isArray(s.tasks)) setTasks(s.tasks);
              if (Array.isArray(s.logs)) setLogs(s.logs);
              if (Array.isArray(s.staffList)) setStaffList(s.staffList);
              if (Array.isArray(s.toolbarItems)) setNavItems(s.toolbarItems);
              if (Array.isArray(s.deleteRequests)) setDeleteRequests(s.deleteRequests);
            }

            const notif = data.notification;
            if (notif) {
              if (notif.kind === 'TASK_TOGGLED' && notif.isCompleted && notif.staffName && notif.taskTitle) {
                showToast(`🔔 ${notif.staffName} vừa xong: "${notif.taskTitle}"`);
                sendTaskNotification(notif.taskTitle, notif.staffName, true);
              } else if (notif.kind === 'TASK_ASSIGNED' && notif.taskTitle) {
                const assignedName = notif.assignedStaffName || 'Toàn bộ ca';
                const isUrgentNotif =
                  notif.isUrgent || notif.priority === 'Gấp' || notif.priority === 'Tối khẩn';
                if (isUrgentNotif) {
                  setUrgentManagerTaskAlert({
                    taskTitle: notif.taskTitle,
                    assignedBy: notif.assignedBy || 'Trưởng Ca',
                    assignedByRole: notif.assignedByRole || 'manager',
                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  });
                  showToast(
                    `🚨 VIỆC GẤP MỚI TỪ TRƯỞNG CA (${notif.assignedBy || 'Trưởng Ca'}): "${notif.taskTitle}"`
                  );
                } else {
                  showToast(`👨‍🍳 Việc mới giao cho ${assignedName}: "${notif.taskTitle}"`);
                }
                sendAssignedTaskNotification(
                  notif.taskTitle,
                  assignedName,
                  notif.priority || 'Thường',
                  notif.assignedBy || 'Trưởng Ca',
                  isUrgentNotif,
                  notif.assignedByRole
                );
              } else if (notif.kind === 'DELETE_REQUEST' && notif.requesterName && notif.newRequestLabel) {
                showToast(`🛡️ ${notif.requesterName} gửi yêu cầu xóa: "${notif.newRequestLabel}"`);
                sendDeleteRequestNotification(notif.requesterName, notif.newRequestLabel);
              } else if (notif.kind === 'MANAGER_1430_CHECK') {
                setManager1430AlertActive(true);
                if (currentUser?.role === 'manager' || currentUser?.role === 'admin') {
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

    return () => {
      eventSource?.close();
    };
  }, [currentUser]);

  // Real-time synchronization across browser tabs and devices via BroadcastChannel & storage events
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'TASKS_UPDATED' && Array.isArray(event.data.tasks)) {
            setTasks(event.data.tasks);
            if (event.data.isCompleted && event.data.staffName && event.data.taskTitle) {
              showToast(`🔔 ${event.data.staffName} vừa xong: "${event.data.taskTitle}"`);
              sendTaskNotification(event.data.taskTitle, event.data.staffName, true);
            }
          } else if (event.data?.type === 'TASK_ASSIGNED' && Array.isArray(event.data.tasks)) {
            setTasks(event.data.tasks);
            const assignedName = event.data.assignedStaffName || 'Toàn bộ ca';
            const isUrgentNotif =
              event.data.isUrgent || event.data.priority === 'Gấp' || event.data.priority === 'Tối khẩn';
            if (isUrgentNotif) {
              setUrgentManagerTaskAlert({
                taskTitle: event.data.taskTitle,
                assignedBy: event.data.assignedBy || 'Trưởng Ca',
                assignedByRole: event.data.assignedByRole || 'manager',
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              });
              showToast(
                `🚨 VIỆC GẤP MỚI TỪ TRƯỞNG CA (${event.data.assignedBy || 'Trưởng Ca'}): "${event.data.taskTitle}"`
              );
            } else {
              showToast(`👨‍🍳 Việc mới giao cho ${assignedName}: "${event.data.taskTitle}"`);
            }
            sendAssignedTaskNotification(
              event.data.taskTitle,
              assignedName,
              event.data.priority || 'Thường',
              event.data.assignedBy || 'Trưởng Ca',
              isUrgentNotif,
              event.data.assignedByRole
            );
          } else if (event.data?.type === 'DELETE_REQUEST_UPDATED' && Array.isArray(event.data.requests)) {
            setDeleteRequests(event.data.requests);
            if (event.data.newRequestLabel && event.data.requesterName) {
              showToast(`🛡️ ${event.data.requesterName} gửi yêu cầu xóa: "${event.data.newRequestLabel}"`);
              sendDeleteRequestNotification(event.data.requesterName, event.data.newRequestLabel);
            }
          } else if (event.data?.type === 'MANAGER_1430_CHECK') {
            setManager1430AlertActive(true);
            if (currentUser?.role === 'manager' || currentUser?.role === 'admin') {
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
          setTasks(JSON.parse(e.newValue));
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
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify(schema));
  }, [schema]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }, [logs]);

  // Show Toast Helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Helper: Tạo yêu cầu xóa khi người thao tác không phải Admin (ví dụ: Quản lý / Trưởng ca)
  const createDeleteRequest = (targetType: DeleteTargetType, targetLabel: string, targetId?: string) => {
    const requesterName = currentUser?.fullName || 'Quản Lý Ca';
    const requesterRole = currentUser?.role || 'manager';

    // Kiểm tra xem đã có yêu cầu đang chờ duyệt cho mục này chưa
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

    pushStateToServer({
      deleteRequests: updatedRequests,
      notification: {
        kind: 'DELETE_REQUEST',
        requesterName,
        newRequestLabel: targetLabel,
      },
    });

    // Đồng bộ sang tab/máy của Admin
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
        channel.postMessage({
          type: 'DELETE_REQUEST_UPDATED',
          requests: updatedRequests,
          newRequestLabel: targetLabel,
          requesterName,
        });
        channel.close();
      } catch {
        // ignore
      }
    }

    sendDeleteRequestNotification(requesterName, targetLabel);
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

  // Task Actions with Live Synchronization & Phone Alerts
  const handleToggleTask = (taskId: string) => {
    const existingTask = tasks.find((t) => t.id === taskId);
    if (!existingTask) return;

    const staffName = currentUser ? currentUser.fullName : 'Đầu Bếp Ca Trực';
    const staffId = currentUser?.id;
    const staffRole = currentUser ? currentUser.role : 'staff';

    // 1. Nếu việc đã được tích hoàn thành:
    // Chỉ cho phép CHÍNH NHÂN VIÊN ĐÓ được tích lại (bỏ tích), người khác không được phép đụng vào
    if (existingTask.completed) {
      const isSameOwner =
        (existingTask.completedById && staffId && existingTask.completedById === staffId) ||
        existingTask.completedBy === staffName;

      if (!isSameOwner) {
        showToast(
          `🔒 Đầu việc này do "${existingTask.completedBy || 'Đầu bếp ca trực'}" thực hiện, người khác không được tích lại!`,
          'error'
        );
        return;
      }
    } else {
      // 2. Khi việc chưa hoàn thành mà có chỉ định đích danh nhân viên (assignedStaffId):
      // Chỉ đúng người được giao (hoặc Admin) mới được tích
      if (
        existingTask.assignedStaffId &&
        currentUser?.id !== existingTask.assignedStaffId &&
        currentUser?.role !== 'admin'
      ) {
        showToast(
          `⚠️ Việc này được Bếp Trưởng chỉ định riêng cho "${existingTask.assignedStaffName}", bạn không thể tích thay!`,
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

    let toggledTaskTitle = '';
    let isNowCompleted = false;

    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === taskId) {
          const willComplete = !t.completed;
          isNowCompleted = willComplete;
          toggledTaskTitle = t.title;
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

      // Push to backend server for cross-device iOS/Android sync
      pushStateToServer({
        tasks: updated,
        notification: {
          kind: 'TASK_TOGGLED',
          taskTitle: toggledTaskTitle,
          staffName,
          isCompleted: isNowCompleted,
        },
      });

      // Broadcast to other tabs & devices in real-time
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('kitchen_tasks_sync_channel');
          channel.postMessage({
            type: 'TASKS_UPDATED',
            tasks: updated,
            staffName,
            taskTitle: toggledTaskTitle,
            isCompleted: isNowCompleted,
          });
          channel.close();
        } catch {
          // ignore
        }
      }

      return updated;
    });

    if (toggledTaskTitle) {
      if (isNowCompleted) {
        showToast(`✅ ${staffName} đã hoàn thành: "${toggledTaskTitle}"`);
        sendTaskNotification(toggledTaskTitle, staffName, true);
      } else {
        showToast(`↩️ ${staffName} đã bỏ tích: "${toggledTaskTitle}"`);
      }
    }
  };

  // Manual & Auto Refresh
  const handleRefreshTasks = () => {
    fetchStateFromServer().then((res) => {
      if (res.ok && res.state && Array.isArray(res.state.tasks)) {
        setTasks(res.state.tasks);
        showToast('Đã đồng bộ danh sách việc mới nhất từ Server!');
        return;
      }
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
        if (saved) {
          setTasks(JSON.parse(saved));
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
    setTasks((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        completed: false,
        completedAt: undefined,
        completedTimestamp: undefined,
        completedBy: undefined,
        completedById: undefined,
        completedByRole: undefined,
      }));
      pushStateToServer({ tasks: updated });
      return updated;
    });
    showToast('Đã làm mới danh sách việc ca này!');
  };

  const handleAddTask = (newTask: Omit<KitchenTask, 'id' | 'completed'>) => {
    const nowShort = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const assignedBy = newTask.createdBy || currentUser?.fullName || 'Trưởng Ca';
    const assignedByRole = newTask.createdByRole || currentUser?.role || 'manager';

    const task: KitchenTask = {
      ...newTask,
      taskType: newTask.taskType || 'daily',
      id: `task-${Date.now()}`,
      completed: false,
      createdBy: assignedBy,
      createdByRole: assignedByRole,
      createdAt: newTask.createdAt || nowShort,
    };

    const assignedTargetName = task.assignedStaffName || 'Toàn bộ ca bếp';
    const isUrgent =
      task.taskType === 'urgent_today' || task.priority === 'Gấp' || task.priority === 'Tối khẩn';

    if (isUrgent) {
      setUrgentManagerTaskAlert({
        taskTitle: task.title,
        assignedBy,
        assignedByRole,
        time: nowShort,
      });
    }

    setTasks((prev) => {
      const updated = [task, ...prev];
      pushStateToServer({
        tasks: updated,
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
      return updated;
    });

    // Bắn thông báo nổi lên điện thoại ngay lập tức
    sendAssignedTaskNotification(
      task.title,
      assignedTargetName,
      task.priority,
      assignedBy,
      isUrgent,
      assignedByRole
    );

    if (isUrgent) {
      showToast(`🚨 Đã giao VIỆC GẤP mới ("${task.title}") & phát thông báo khẩn toàn ca!`);
    } else if (task.assignedStaffName) {
      showToast(`📲 Đã giao việc cho ${task.assignedStaffName} & phát thông báo lên điện thoại!`);
    } else {
      showToast('📲 Đã thêm đầu việc mới & thông báo cho toàn ca bếp!');
    }
  };

  // Cập nhật / chỉnh sửa đầu việc (dành cho Trưởng Ca @manager & Admin @admin)
  const handleUpdateTask = (updatedTask: KitchenTask) => {
    const nowShort = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const assignedBy = currentUser?.fullName || updatedTask.createdBy || 'Trưởng Ca';
    const assignedByRole = currentUser?.role || updatedTask.createdByRole || 'manager';
    const isUrgent =
      updatedTask.taskType === 'urgent_today' ||
      updatedTask.priority === 'Gấp' ||
      updatedTask.priority === 'Tối khẩn';

    if (isUrgent) {
      setUrgentManagerTaskAlert({
        taskTitle: updatedTask.title,
        assignedBy,
        assignedByRole,
        time: nowShort,
      });
    }

    setTasks((prev) => {
      const next = prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
      pushStateToServer({
        tasks: next,
        notification: isUrgent
          ? {
              kind: 'TASK_ASSIGNED',
              taskTitle: updatedTask.title,
              assignedStaffName: updatedTask.assignedStaffName || 'Toàn bộ ca bếp',
              priority: updatedTask.priority,
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
            taskTitle: updatedTask.title,
            assignedStaffName: updatedTask.assignedStaffName || 'Toàn bộ ca bếp',
            priority: updatedTask.priority,
            assignedBy,
            assignedByRole,
            isUrgent,
          });
          channel.close();
        } catch {
          // ignore
        }
      }
      return next;
    });

    if (isUrgent) {
      sendAssignedTaskNotification(
        updatedTask.title,
        updatedTask.assignedStaffName || 'Toàn bộ ca bếp',
        updatedTask.priority,
        assignedBy,
        true,
        assignedByRole
      );
      showToast(`🚨 Đã cập nhật thành VIỆC GẤP & thông báo cho toàn ca: "${updatedTask.title}"`);
    } else {
      showToast(`✅ Đã cập nhật đầu việc: "${updatedTask.title}"`);
    }
  };

  // Riêng xóa trong Checklist Giao Việc của Bếp Trưởng / Trưởng Ca thì được xóa trực tiếp theo yêu cầu
  const handleDeleteTask = (id: string) => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      pushStateToServer({ tasks: updated });
      return updated;
    });
    showToast('Đã xóa đầu việc khỏi danh sách giao việc');
  };

  const handleClearAllTasks = () => {
    setTasks([]);
    pushStateToServer({ tasks: [] });
    showToast('Đã dọn dẹp toàn bộ danh sách việc giao');
  };

  const handleLoadTaskPreset = (type: 'standard' | 'haccp' | 'bakery') => {
    if (type === 'standard') {
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
      setTasks(haccpTasks);
      pushStateToServer({ tasks: haccpTasks });
      showToast('Đã nạp mẫu Vệ Sinh An Toàn HACCP!');
    }
  };

  // Dynamic Field Actions
  const handleAddField = (newField: Omit<DynamicField, 'id'>) => {
    const field: DynamicField = {
      ...newField,
      id: `field-${Date.now()}`,
    };
    setSchema((prev) => [...prev, field]);
    showToast('Đã thêm trường thông tin mới!');
  };

  const handleDeleteField = (id: string) => {
    if (currentUser?.role !== 'admin') {
      const target = schema.find((f) => f.id === id);
      createDeleteRequest('nav_item', `Trường thông tin: ${target?.label || id}`, id);
      return;
    }
    setSchema((prev) => prev.filter((f) => f.id !== id));
    showToast('Đã xóa trường thông tin');
  };

  // Staff Personnel Actions
  const handleAddStaff = (newStaff: Omit<StaffUser, 'id'>) => {
    const staff: StaffUser = {
      ...newStaff,
      id: `staff-${Date.now()}`,
    };
    setStaffList((prev) => {
      const updated = [...prev, staff];
      pushStateToServer({ staffList: updated });
      return updated;
    });
    showToast(`Đã thêm nhân sự: ${staff.fullName}`);
  };

  const handleUpdateStaff = (updated: StaffUser) => {
    setStaffList((prev) => {
      const next = prev.map((s) => (s.id === updated.id ? updated : s));
      pushStateToServer({ staffList: next });
      return next;
    });
    if (currentUser?.id === updated.id) {
      setCurrentUser(updated);
    }
    showToast(`Đã cập nhật thông tin: ${updated.fullName}`);
  };

  const handleDeleteStaff = (id: string) => {
    const target = staffList.filter((s) => s.id === id)[0];
    if (currentUser?.role !== 'admin') {
      createDeleteRequest('staff', `Nhân sự: ${target?.fullName || id}`, id);
      return;
    }
    setStaffList((prev) => {
      const next = prev.filter((s) => s.id !== id);
      pushStateToServer({ staffList: next });
      return next;
    });
    if (currentUser?.id === id) {
      const remaining = staffList.filter((s) => s.id !== id);
      setCurrentUser(remaining[0] || null);
    }
    showToast('Đã xóa tài khoản nhân sự');
  };

  const handleSwitchUser = (user: StaffUser) => {
    setCurrentUser(user);
    showToast(`Đã chuyển sang tài khoản: ${user.fullName}`);
  };

  const handleLogin = (user: StaffUser) => {
    const updated = {
      ...user,
      status: 'active' as const,
      lastLogin: new Date().toLocaleString('vi-VN'),
    };
    setCurrentUser(updated);
    setStaffList((prev) => {
      const next = prev.map((s) => (s.id === user.id ? updated : s));
      pushStateToServer({ staffList: next });
      return next;
    });
    showToast(`Xin chào ${user.fullName}! Đăng nhập thành công.`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    showToast('Đã đăng xuất ca làm việc.');
  };

  // Submit Shift Log
  const handleSubmitShift = (logData: Omit<ShiftLog, 'id' | 'timestamp'>) => {
    const newLog: ShiftLog = {
      ...logData,
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleString('vi-VN'),
    };
    setLogs((prev) => {
      const updated = [newLog, ...prev];
      pushStateToServer({ logs: updated });
      return updated;
    });
    showToast('🎉 Đã nộp báo cáo ca bếp thành công!');

    // Automatically navigate to history tab if available, else first visible tab
    const historyItem = navItems.find((item) => item.targetType === 'history' && item.visible);
    if (historyItem) {
      setActiveTabId(historyItem.id);
    }
  };

  // Log Actions (Chỉ Admin được xóa thẳng, Quản lý bấm xóa sẽ gửi yêu cầu cho Admin duyệt)
  const handleDeleteLog = (id: string) => {
    if (currentUser?.role === 'admin') {
      setLogs((prev) => {
        const updated = prev.filter((l) => l.id !== id);
        pushStateToServer({ logs: updated });
        return updated;
      });
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
    <div className="min-h-screen bg-stone-100/90 text-stone-800 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* Dynamic Header Navbar with Toolbar items & Quick Config */}
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
      />

      {/* Global Urgent Task Notification Banner (Khi Trưởng Ca giao việc gấp mới) */}
      {urgentManagerTaskAlert && (
        <div className="max-w-7xl w-full mx-auto px-3.5 pt-3 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 text-white border-2 border-rose-400 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm">
              <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-md shrink-0 animate-bounce">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-mono font-extrabold text-[11px] uppercase">
                    VIỆC GẤP MỚI TỪ TRƯỞNG CA • {urgentManagerTaskAlert.time}
                  </span>
                  <span className="font-extrabold text-amber-200">
                    Giao bởi: {urgentManagerTaskAlert.assignedBy} (@{urgentManagerTaskAlert.assignedByRole || 'manager'})
                  </span>
                </div>
                <p className="text-white font-bold text-sm sm:text-base mt-1">
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
                  className="px-3 py-1.5 bg-white text-rose-950 hover:bg-rose-100 rounded-xl text-xs font-extrabold transition"
                >
                  Xem Việc Gấp Ngay
                </button>
              )}
              <button
                onClick={() => setUrgentManagerTaskAlert(null)}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-600 text-white border border-rose-400/50 rounded-xl text-xs font-bold flex items-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Đã nhận thông báo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global 14:30 PM Notification Banner for @manager (and @admin) */}
      {manager1430AlertActive && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
        <div className="max-w-7xl w-full mx-auto px-3.5 pt-3 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white border-2 border-indigo-400/50 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm">
              <div className="p-2.5 bg-amber-500 text-stone-950 rounded-xl shadow-md shrink-0 animate-bounce">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-amber-400 text-stone-950 font-mono font-extrabold text-[11px]">
                    14:30 CHIỀU • @manager
                  </span>
                  <span className="font-extrabold text-amber-200">
                    Đến giờ kiểm tra tiến độ Checklist ca bếp!
                  </span>
                </div>
                <p className="text-indigo-100 text-xs mt-1">
                  Hiện đã hoàn thành <strong>{completedTasksCount}/{tasks.length}</strong> đầu việc
                  {urgentPendingCount > 0 ? (
                    <span className="text-rose-300 font-bold">
                      {' '}• Còn {urgentPendingCount} việc Trong ngày gấp chưa xong!
                    </span>
                  ) : (
                    <span className="text-emerald-300 font-semibold"> • Không còn việc gấp tồn đọng.</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {currentNavItem?.targetType !== 'checklist' && (
                <button
                  onClick={() => {
                    const checklistTab = navItems.find((i) => i.targetType === 'checklist');
                    if (checklistTab) setActiveTabId(checklistTab.id);
                  }}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold transition"
                >
                  Mở Checklist
                </button>
              )}
              <button
                onClick={handleAcknowledgeManager1430}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Đã kiểm tra (14:30)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Admin Approval Banner: Hiển thị nổi bật cho Admin ở mọi trang nếu có yêu cầu xóa từ Quản lý */}
      {currentUser?.role === 'admin' && pendingDeleteRequests.length > 0 && currentNavItem?.targetType !== 'history' && (
        <div className="max-w-7xl w-full mx-auto px-3.5 pt-3 sm:px-6 lg:px-8">
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-950">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Có {pendingDeleteRequests.length} yêu cầu xóa từ Quản lý chờ bạn duyệt: </span>
                <span className="text-rose-700 font-semibold">{pendingDeleteRequests[0].targetLabel}</span>
                <span className="text-stone-500 text-xs"> (Gửi bởi {pendingDeleteRequests[0].requestedBy})</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => handleRejectDeleteRequest(pendingDeleteRequests[0].id)}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold flex items-center gap-1 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Không duyệt</span>
              </button>
              <button
                onClick={() => handleApproveDeleteRequest(pendingDeleteRequests[0].id)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Duyệt xóa ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-3.5 py-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
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
              />
            )}

            {currentNavItem.targetType === 'admin' && (
              <AdminConfigView
                appConfig={appConfig}
                onUpdateAppConfig={(cfg) => setAppConfig(cfg)}
                navItems={navItems}
                onUpdateNavItems={(items) => {
                  setNavItems(items);
                  pushStateToServer({ toolbarItems: items });
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
          <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-stone-200 shadow-sm max-w-md mx-auto my-12 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900">
                Giao Diện Giới Hạn Theo Vai Trò
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                Tài khoản của bạn ({currentUser ? currentUser.fullName : 'Chưa đăng nhập'} - {currentUser?.role === 'manager' ? 'Trưởng Ca' : 'Nhân Viên Bếp'}) không có quyền truy cập vào mục này.
              </p>
            </div>
            <button
              onClick={() => {
                const firstAllowed = navItems.find((i) => i.visible && canRoleAccessTab(currentUser?.role, i.targetType, i));
                if (firstAllowed) setActiveTabId(firstAllowed.id);
              }}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
            >
              Về Bảng Kiểm Ca Nhân Viên
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-4 border-t border-stone-800 text-center mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} {appConfig.appTitle} • Hệ Thống Quản Lý Bếp & ATTP</p>
          {currentUser?.role === 'admin' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const adminItem = navItems.find((i) => i.targetType === 'admin');
                  if (adminItem) {
                    setActiveTabId(adminItem.id);
                    setAdminInitialSubTab('nav');
                  }
                }}
                className="text-amber-400 hover:underline font-medium"
              >
                Cấu hình thanh công cụ (Admin)
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Dedicated Mobile Bottom Navigation Bar (md:hidden) */}
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
          showToast('Đã cập nhật thanh công cụ thành công!');
        }}
        onOpenFullAdmin={() => {
          const adminItem = navItems.find((i) => i.targetType === 'admin');
          if (adminItem) {
            setActiveTabId(adminItem.id);
            setAdminInitialSubTab('nav');
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

      {/* Floating Toast Notification (Positioned above mobile bottom bar) */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-5 right-3 md:right-5 left-3 sm:left-auto z-50 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 transition-all duration-300 border-l-4 ${
            toast.type === 'error'
              ? 'bg-rose-950 text-white border-rose-500'
              : 'bg-stone-900 text-white border-emerald-500'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
