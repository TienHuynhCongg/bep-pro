import React, { useState, useEffect } from 'react';
import { KitchenTask, ShiftLog, StaffUser, TaskCategory, TaskPriority, TaskScheduleType } from '../types.ts';
import { requestNotificationPermission, sendTaskNotification } from '../utils/notificationSync.ts';
import {
  RotateCcw,
  Send,
  Plus,
  Search,
  RefreshCw,
  Bell,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';

interface ChecklistViewProps {
  tasks: KitchenTask[];
  onToggleTask: (taskId: string) => void;
  onResetTasks: () => void;
  onAddTask: (task: Omit<KitchenTask, 'id' | 'completed'>) => void;
  onUpdateTask?: (task: KitchenTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onRefreshTasks: () => void;
  onSubmitShift: (log: Omit<ShiftLog, 'id' | 'timestamp'>) => void;
  currentUser?: StaffUser | null;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  tasks,
  onToggleTask,
  onResetTasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onRefreshTasks,
  onSubmitShift,
  currentUser = null,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddQuickTask, setShowAddQuickTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<KitchenTask['category']>('Sơ chế');
  const [quickPriority, setQuickPriority] = useState<KitchenTask['priority']>('Gấp');
  const [quickTaskType, setQuickTaskType] = useState<'daily' | 'urgent_today'>('urgent_today');

  // Chế độ chỉnh sửa danh sách đầu việc cho Trưởng Ca (@manager) và Admin (@admin)
  const [isManageMode, setIsManageMode] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editTaskType, setEditTaskType] = useState<TaskScheduleType>('daily');
  const [editPriority, setEditPriority] = useState<TaskPriority>('Thường');
  const [editCategory, setEditCategory] = useState<TaskCategory>('Sơ chế');

  // Inline confirmation state cho nút Reset Checklist (tránh lỗi window.confirm trên iOS/Android)
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const [isRefreshing, setIsRefreshing] = useState(false);

  const AUTO_RELOAD_INTERVAL = 1800; // 30 mins
  const [secondsLeft, setSecondsLeft] = useState<number>(AUTO_RELOAD_INTERVAL);

  const [hasNotifPermission, setHasNotifPermission] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onRefreshTasks();
          return AUTO_RELOAD_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefreshTasks]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    onRefreshTasks();
    setSecondsLeft(AUTO_RELOAD_INTERVAL);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  };

  const handleEnableNotification = async () => {
    const granted = await requestNotificationPermission();
    setHasNotifPermission(granted);
    if (granted) {
      sendTaskNotification('Đã bật thông báo ca bếp', currentUser?.fullName || 'Hệ thống', true);
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    onAddTask({
      title: trimmed,
      category: quickCategory,
      priority: quickPriority,
      taskType: quickTaskType,
      assignedShift: quickTaskType === 'urgent_today' ? 'Trong ngày gấp' : 'Hàng ngày (Daily 24h)',
      createdBy: currentUser?.fullName || 'Trưởng Ca',
      createdByRole: currentUser?.role || 'manager',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
    setQuickTitle('');
    setShowAddQuickTask(false);
  };

  const startEditTask = (task: KitchenTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditTaskType(task.taskType || 'daily');
    setEditPriority(task.priority || 'Thường');
    setEditCategory(task.category || 'Sơ chế');
  };

  const handleSaveEditTask = (task: KitchenTask, e: React.FormEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed || !onUpdateTask) return;
    onUpdateTask({
      ...task,
      title: trimmed,
      taskType: editTaskType,
      priority: editTaskType === 'urgent_today' && editPriority === 'Thường' ? 'Gấp' : editPriority,
      category: editCategory,
      createdBy: currentUser?.fullName || task.createdBy || 'Trưởng Ca',
      createdByRole: currentUser?.role || task.createdByRole || 'manager',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
    setEditingTaskId(null);
  };

  const handleToggleUrgentQuick = (task: KitchenTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateTask) return;
    const currentlyUrgent = isTaskUrgent(task);
    onUpdateTask({
      ...task,
      taskType: currentlyUrgent ? 'daily' : 'urgent_today',
      priority: currentlyUrgent ? 'Thường' : 'Gấp',
      createdBy: currentUser?.fullName || task.createdBy || 'Trưởng Ca',
      createdByRole: currentUser?.role || task.createdByRole || 'manager',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleSubmit = () => {
    const staffName = currentUser ? currentUser.fullName : 'Đầu Bếp Ca Trực';
    const shiftName = currentUser?.station || 'Ca Làm Việc';
    const dateStr = new Date().toLocaleDateString('vi-VN');

    onSubmitShift({
      dateStr,
      shiftName,
      staffName,
      tasks: tasks.map((t) => ({ ...t })),
      completedCount: completedTasks,
      totalCount: totalTasks,
      fields: [
        { id: 'f-staff', label: 'Người gửi báo cáo', value: staffName },
        { id: 'f-time', label: 'Thời gian hoàn tất', value: new Date().toLocaleTimeString('vi-VN') },
      ],
    });
  };

  const isTaskUrgent = (t: KitchenTask) =>
    (t.taskType || 'daily') === 'urgent_today' || t.priority === 'Gấp' || t.priority === 'Tối khẩn';

  const urgentPendingTasks = tasks.filter((t) => !t.completed && isTaskUrgent(t));

  const filteredTasks = tasks
    .filter((t) => {
      const effectiveType = t.taskType || 'daily';
      const matchesCat =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'daily'
          ? effectiveType === 'daily'
          : selectedCategory === 'urgent_today'
          ? effectiveType === 'urgent_today'
          : selectedCategory === 'urgent'
          ? isTaskUrgent(t)
          : t.category === selectedCategory;

      const matchesSearch =
        searchQuery.trim() === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      const aUrgent = isTaskUrgent(a) ? 1 : 0;
      const bUrgent = isTaskUrgent(b) ? 1 : 0;
      if (bUrgent !== aUrgent) return bUrgent - aUrgent;
      return 0;
    });

  const categories: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'Tất cả' },
    { id: 'urgent_today', label: 'Trong ngày gấp' },
    { id: 'daily', label: 'Daily 24h' },
    { id: 'Sơ chế', label: 'Sơ chế' },
    { id: 'Nấu nướng', label: 'Nấu nướng' },
    { id: 'Vệ sinh', label: 'Vệ sinh' },
    { id: 'Kiểm kê', label: 'Kiểm kê' },
    { id: 'An toàn ATTP', label: 'ATTP' },
  ];

  return (
    <div className="space-y-4">
      {/* Banner cảnh báo việc gấp từ Trưởng Ca */}
      {urgentPendingTasks.length > 0 && (
        <div className="bg-rose-600 text-white rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-white text-rose-700 text-[10px] font-extrabold uppercase tracking-wider">
                Việc gấp từ Trưởng Ca
              </span>
              <span className="text-xs font-semibold text-rose-100">
                {urgentPendingTasks.length} đầu việc cần ưu tiên xử lý ngay
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-white truncate">
              {urgentPendingTasks[0].title}
              {urgentPendingTasks.length > 1 ? ` (+${urgentPendingTasks.length - 1} việc gấp khác)` : ''}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === 'urgent' ? 'all' : 'urgent')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-800 hover:bg-rose-900 text-white transition shrink-0"
          >
            {selectedCategory === 'urgent' ? 'Hiện tất cả' : 'Lọc việc gấp'}
          </button>
        </div>
      )}

      {/* Main Card - Chuẩn Quốc Tế (Minimalist, Clean Typography, Fast Touch) */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-4 sm:p-6 space-y-4">
        {/* Compact Status & Progress Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-zinc-100">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-950 tracking-tight">
                  Checklist Ca Bếp
                </h2>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 text-zinc-800">
                  {completedTasks}/{totalTasks}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Tự reload: <span className="font-mono font-semibold text-zinc-700">{formatTime(secondsLeft)}</span> • 14:30 báo @manager
              </p>
            </div>

            {!hasNotifPermission && (
              <button
                type="button"
                onClick={handleEnableNotification}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition flex items-center gap-1 shrink-0"
              >
                <Bell className="w-3 h-3" />
                <span>Bật thông báo</span>
              </button>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleManualRefresh}
              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            {/* Nút Reset Thủ Công Checklist (Chỉ @admin, xác nhận 2 chạm không bị lỗi trên đt) */}
            {isAdmin && (
              confirmReset ? (
                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onResetTasks();
                      setConfirmReset(false);
                    }}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
                  >
                    Xác nhận Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2 py-1.5 text-zinc-600 hover:text-zinc-900 text-xs font-semibold"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Checklist</span>
                </button>
              )
            )}

            {/* Nút Tăng & Chỉnh Sửa Đầu Việc (Dành cho Trưởng Ca & Admin) */}
            {isManagerOrAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddQuickTask(!showAddQuickTask)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-950 hover:bg-zinc-800 text-white transition flex items-center gap-1.5 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tăng đầu việc</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsManageMode(!isManageMode);
                    setEditingTaskId(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border active:scale-95 ${
                    isManageMode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isManageMode ? 'Xong' : 'Sửa danh sách'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Clean Progress Line */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-medium">Tiến độ hoàn thành</span>
            <span className="font-bold text-zinc-900">{progressPercent}%</span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-600' : 'bg-zinc-900'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Form Tăng Đầu Việc (Trưởng Ca & Admin) */}
        {isManagerOrAdmin && showAddQuickTask && (
          <form
            onSubmit={handleQuickAdd}
            className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 space-y-3"
          >
            <div className="text-xs font-bold text-zinc-900">
              Thêm đầu việc mới vào danh sách
            </div>
            <input
              type="text"
              placeholder="Nhập tên công việc cần thêm..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              className="w-full p-2.5 bg-white border border-zinc-300 rounded-xl text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none"
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={quickTaskType}
                onChange={(e) => {
                  const val = e.target.value as 'daily' | 'urgent_today';
                  setQuickTaskType(val);
                  if (val === 'urgent_today') setQuickPriority('Gấp');
                  else setQuickPriority('Thường');
                }}
                className="p-2 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800"
              >
                <option value="urgent_today">Trong ngày gấp (Khung đỏ)</option>
                <option value="daily">Daily (Tự reset 24h)</option>
              </select>

              <select
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value as KitchenTask['priority'])}
                className="p-2 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800"
              >
                <option value="Thường">Ưu tiên: Thường</option>
                <option value="Gấp">Ưu tiên: Gấp</option>
                <option value="Tối khẩn">Ưu tiên: Tối khẩn</option>
              </select>

              <select
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value as KitchenTask['category'])}
                className="p-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-800"
              >
                <option value="Sơ chế">Sơ chế</option>
                <option value="Nấu nướng">Nấu nướng</option>
                <option value="Vệ sinh">Vệ sinh</option>
                <option value="Kiểm kê">Kiểm kê</option>
                <option value="An toàn ATTP">An toàn ATTP</option>
              </select>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowAddQuickTask(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white"
                >
                  Thêm việc
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[190px]">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm nhanh đầu việc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-10 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-400">
              <p className="text-sm font-medium">Không có đầu việc nào trong mục này</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isUrgent = isTaskUrgent(task);
              const currentStaffName = currentUser ? currentUser.fullName : 'Đầu Bếp Ca Trực';
              const isSameOwner =
                (task.completedById && currentUser?.id && task.completedById === currentUser.id) ||
                task.completedBy === currentStaffName;
              const isLockedForCurrentUser = task.completed && !isSameOwner;
              const isEditingThis = editingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => {
                    if (!isEditingThis) onToggleTask(task.id);
                  }}
                  className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl transition-all gap-3 touch-manipulation select-none ${
                    task.completed
                      ? isLockedForCurrentUser
                        ? isUrgent
                          ? 'bg-emerald-50/50 border-2 border-rose-500 cursor-not-allowed'
                          : 'bg-zinc-50 border border-zinc-200 cursor-not-allowed'
                        : isUrgent
                        ? 'bg-emerald-50/60 border-2 border-rose-500 cursor-pointer active:scale-[0.99]'
                        : 'bg-zinc-50/90 border border-zinc-200 cursor-pointer active:scale-[0.99]'
                      : isUrgent
                      ? 'bg-rose-50/40 border-2 border-rose-500 hover:bg-rose-50/70 cursor-pointer active:scale-[0.99]'
                      : 'bg-white hover:bg-zinc-50 border border-zinc-200/90 cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  {/* Left: Checkbox + Title + Completion Time & Date only */}
                  <div className="flex items-start gap-3 flex-1 w-full">
                    <div className="mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        disabled={isLockedForCurrentUser}
                        onChange={() => {}}
                        className={`w-5 h-5 rounded-md text-zinc-900 border-zinc-300 focus:ring-zinc-900 accent-emerald-600 ${
                          isLockedForCurrentUser ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        }`}
                      />
                    </div>

                    {isEditingThis ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-white p-3 rounded-xl border border-zinc-300 space-y-2.5"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full p-2 border border-zinc-300 rounded-lg text-sm font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none"
                          placeholder="Tên đầu việc..."
                          autoFocus
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={editTaskType}
                            onChange={(e) => {
                              const val = e.target.value as TaskScheduleType;
                              setEditTaskType(val);
                              if (val === 'urgent_today') setEditPriority('Gấp');
                              else setEditPriority('Thường');
                            }}
                            className="p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800"
                          >
                            <option value="daily">Daily (Tự reset 24h)</option>
                            <option value="urgent_today">Trong ngày gấp (Khung đỏ)</option>
                          </select>

                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                            className="p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800"
                          >
                            <option value="Thường">Ưu tiên: Thường</option>
                            <option value="Gấp">Ưu tiên: Gấp</option>
                            <option value="Tối khẩn">Ưu tiên: Tối khẩn</option>
                          </select>

                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as TaskCategory)}
                            className="p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-800"
                          >
                            <option value="Sơ chế">Sơ chế</option>
                            <option value="Nấu nướng">Nấu nướng</option>
                            <option value="Vệ sinh">Vệ sinh</option>
                            <option value="Kiểm kê">Kiểm kê</option>
                            <option value="An toàn ATTP">An toàn ATTP</option>
                          </select>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTaskId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Hủy</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSaveEditTask(task, e)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Lưu</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5 flex-1">
                        <p
                          className={`text-sm sm:text-[15px] font-medium leading-snug ${
                            task.completed
                              ? 'line-through text-zinc-400'
                              : isUrgent
                              ? 'text-rose-950 font-semibold'
                              : 'text-zinc-900'
                          }`}
                        >
                          {task.title}
                        </p>

                        {task.completed && task.completedAt && (
                          <div className="text-xs font-mono text-emerald-700">
                            {task.completedAt}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Edit Controls (if Manager/Admin) & Status */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isManagerOrAdmin && isManageMode && !isEditingThis && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={(e) => handleToggleUrgentQuick(task, e)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            isUrgent
                              ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300'
                              : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                          }`}
                        >
                          {isUrgent ? 'Daily' : 'Đặt Gấp'}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => startEditTask(task, e)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 flex items-center gap-1 transition"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>

                        {onDeleteTask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTask(task.id);
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                            title="Xóa đầu việc"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {task.completed ? (
                      <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        Đã xong
                      </span>
                    ) : (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${
                          isUrgent
                            ? 'text-rose-700 font-bold bg-rose-100/80 border border-rose-200'
                            : 'text-zinc-500 bg-zinc-100'
                        }`}
                      >
                        Chờ làm
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Submit Shift Report Footer */}
        <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">
            Hoàn tất ca trực, nhấn gửi báo cáo để lưu vào lịch sử vận hành.
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full sm:w-auto px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Send className="w-4 h-4" />
            <span>Gửi Báo Cáo Ca</span>
          </button>
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 px-3.5 py-2 bg-white/95 backdrop-blur-md border-t border-zinc-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {progressPercent}%
          </div>
          <div className="text-xs leading-tight">
            <span className="font-bold text-zinc-900 block">
              {completedTasks}/{totalTasks} hoàn thành
            </span>
            <span className="text-zinc-500 text-[10px]">Tiến độ ca trực</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl border border-zinc-200 active:scale-95 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-3.5 py-2 bg-zinc-950 active:scale-95 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Nộp Ca</span>
          </button>
        </div>
      </div>
    </div>
  );
};
