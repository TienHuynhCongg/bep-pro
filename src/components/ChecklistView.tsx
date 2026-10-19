import React, { useState, useEffect } from 'react';
import { KitchenTask, ShiftLog, StaffUser } from '../types.ts';
import { requestNotificationPermission, sendTaskNotification } from '../utils/notificationSync.ts';
import {
  ClipboardCheck,
  RotateCcw,
  Send,
  Plus,
  CheckCircle2,
  Clock,
  Flame,
  Search,
  RefreshCw,
  Bell,
  BellRing,
  User,
  Check,
  Sparkles,
} from 'lucide-react';

interface ChecklistViewProps {
  tasks: KitchenTask[];
  onToggleTask: (taskId: string) => void;
  onResetTasks: () => void;
  onAddTask: (task: Omit<KitchenTask, 'id' | 'completed'>) => void;
  onRefreshTasks: () => void;
  onSubmitShift: (log: Omit<ShiftLog, 'id' | 'timestamp'>) => void;
  currentUser?: StaffUser | null;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  tasks,
  onToggleTask,
  onResetTasks,
  onAddTask,
  onRefreshTasks,
  onSubmitShift,
  currentUser = null,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddQuickTask, setShowAddQuickTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory] = useState<KitchenTask['category']>('Sơ chế');
  const [quickPriority, setQuickPriority] = useState<KitchenTask['priority']>('Gấp');
  const [quickTaskType, setQuickTaskType] = useState<'daily' | 'urgent_today'>('urgent_today');

  // Manual refresh spinner state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 30-minute Auto Reload Countdown (1800 seconds)
  const AUTO_RELOAD_INTERVAL = 1800; // 30 mins
  const [secondsLeft, setSecondsLeft] = useState<number>(AUTO_RELOAD_INTERVAL);

  // Push Notification Permission State
  const [hasNotifPermission, setHasNotifPermission] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  // Countdown timer for 30-minute auto-reload
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Trigger automatic refresh
          onRefreshTasks();
          return AUTO_RELOAD_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefreshTasks]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format remaining time until 24h reset for completed daily tasks
  const getDailyResetRemainingText = (completedTimestamp?: number) => {
    if (!completedTimestamp) return 'Tự reset sau 24h';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const remainingMs = Math.max(0, completedTimestamp + TWENTY_FOUR_HOURS - Date.now());
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    return `Tự reset sau ${hours}h ${mins}p`;
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    onRefreshTasks();
    setSecondsLeft(AUTO_RELOAD_INTERVAL); // Reset countdown on manual refresh
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleEnableNotification = async () => {
    const granted = await requestNotificationPermission();
    setHasNotifPermission(granted);
    if (granted) {
      sendTaskNotification('Đã kích hoạt thông báo đẩy ca bếp', currentUser?.fullName || 'Hệ thống', true);
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onAddTask({
      title: quickTitle.trim(),
      category: quickCategory,
      priority: quickPriority,
      taskType: quickTaskType,
      assignedShift: quickTaskType === 'urgent_today' ? 'Trong ngày gấp' : 'Hàng ngày (Daily 24h)',
    });
    setQuickTitle('');
    setShowAddQuickTask(false);
  };

  const handleSubmit = () => {
    const staffName = currentUser ? currentUser.fullName : 'Đầu Bếp Ca Trực';
    const shiftName = currentUser?.station || 'Ca Làm Việc';
    const dateStr = new Date().toLocaleDateString('vi-VN');

    onSubmitShift({
      dateStr,
      shiftName,
      staffName,
      tasks: JSON.parse(JSON.stringify(tasks)),
      completedCount: completedTasks,
      totalCount: totalTasks,
      fields: [
        { id: 'f-staff', label: 'Người gửi báo cáo', value: staffName },
        { id: 'f-time', label: 'Thời gian hoàn tất', value: new Date().toLocaleTimeString('vi-VN') },
      ],
    });
  };

  // Filter tasks & sort urgent tasks to the top of the list
  const isTaskUrgent = (t: KitchenTask) =>
    (t.taskType || 'daily') === 'urgent_today' || t.priority === 'Gấp' || t.priority === 'Tối khẩn';

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
    { id: 'all', label: 'Tất cả việc' },
    { id: 'daily', label: 'Daily (Tự reset 24h)' },
    { id: 'urgent_today', label: 'Trong ngày gấp' },
    { id: 'Sơ chế', label: 'Sơ chế' },
    { id: 'Nấu nướng', label: 'Nấu nướng' },
    { id: 'Vệ sinh', label: 'Vệ sinh' },
    { id: 'Kiểm kê', label: 'Kiểm kê & Bảo quản' },
    { id: 'An toàn ATTP', label: 'An toàn ATTP' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/90 p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-stone-100 pb-5 mb-6 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200/70 inline-flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-600" /> Báo Cáo Ca Bếp Trực Tiếp
              </span>
              <span className="text-xs text-stone-500 font-medium bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                {new Date().toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="text-xs text-indigo-800 font-mono font-bold bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-flex items-center gap-1">
                14:30 tự báo @manager kiểm tra
              </span>

              {/* Notification Banner Button */}
              {!hasNotifPermission ? (
                <button
                  onClick={handleEnableNotification}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200 transition inline-flex items-center gap-1.5 animate-pulse"
                  title="Nhấn để nhận thông báo nổi ra màn hình điện thoại khi có người làm xong việc"
                >
                  <BellRing className="w-3.5 h-3.5 text-rose-600" />
                  <span>Bật thông báo điện thoại</span>
                </button>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                  <Bell className="w-3 h-3 text-emerald-600" />
                  <span>Đã bật thông báo nổi</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 sm:p-5 rounded-2xl border border-amber-200/80 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-950">Tiến độ hoàn thành ca:</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                {progressPercent === 100 ? 'Hoàn tất 100%' : `${completedTasks} / ${totalTasks} việc`}
              </span>
            </div>
            <span className="text-lg font-black text-amber-700">{progressPercent}%</span>
          </div>

          <div className="w-full bg-stone-200 rounded-full h-3.5 overflow-hidden p-0.5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {progressPercent === 100 && (
            <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tuyệt vời! Toàn bộ đầu việc bếp ca này đã hoàn thành 100%.
            </p>
          )}
        </div>

        {/* Task List Header & Controls (WITH MANUAL REFRESH & AUTO-RELOAD COUNTDOWN) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-stone-50 p-3 sm:p-4 rounded-2xl border border-stone-200">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span>Danh Sách Đầu Việc Bếp ({filteredTasks.length}/{totalTasks})</span>
              </h3>
              {/* Auto Reload 30m Info */}
              <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-900 font-medium border border-amber-300/60">
                  <span>Tự động reload sau:</span>
                  <strong className="font-mono text-amber-950 font-bold">{formatTime(secondsLeft)}</strong>
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline text-stone-400">Daily tự reset sau 24h</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Nút Làm Mới Thủ Công */}
              <button
                onClick={handleManualRefresh}
                className="px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-stone-300 shadow-xs flex-1 sm:flex-initial"
                title="Làm mới và lấy dữ liệu mới nhất ngay lập tức"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-700' : 'text-stone-600'}`} />
                <span>{isRefreshing ? 'Đang tải...' : 'Làm Mới Thủ Công'}</span>
              </button>

              <button
                onClick={() => setShowAddQuickTask(!showAddQuickTask)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition flex-1 sm:flex-initial"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Việc Gấp</span>
              </button>
            </div>
          </div>

          {/* Quick Task Add Form */}
          {showAddQuickTask && (
            <form onSubmit={handleQuickAdd} className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
              <div className="text-xs font-bold text-amber-900 uppercase">Thêm Việc Vào Checklist Ca:</div>
              <input
                type="text"
                placeholder="Tên công việc (VD: Lau sàn dầu mỡ sau giờ cao điểm, cấp đông gấp mẻ gà mới...)"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                autoFocus
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={quickTaskType}
                  onChange={(e) => {
                    const val = e.target.value as 'daily' | 'urgent_today';
                    setQuickTaskType(val);
                    if (val === 'urgent_today') setQuickPriority('Gấp');
                  }}
                  className="p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-stone-800 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="urgent_today">Loại: Trong ngày gấp</option>
                  <option value="daily">Loại: Daily (Tự reset sau 24h)</option>
                </select>

                <select
                  value={quickPriority}
                  onChange={(e) => setQuickPriority(e.target.value as KitchenTask['priority'])}
                  className="p-2 bg-white border border-amber-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Thường">Ưu tiên: Thường</option>
                  <option value="Gấp">Ưu tiên: Gấp</option>
                  <option value="Tối khẩn">Ưu tiên: Tối khẩn</option>
                </select>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddQuickTask(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-200"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-sm"
                  >
                    Thêm việc
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-amber-800 text-white shadow-sm'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm việc nhanh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Actual Tasks Checklist */}
          <div className="space-y-2 mt-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-10 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400">
                <ClipboardCheck className="w-10 h-10 mx-auto text-stone-300 mb-2" />
                <p className="text-sm font-medium">Không tìm thấy đầu việc nào phù hợp</p>
                <p className="text-xs text-stone-400 mt-1">Hãy thử xóa bộ lọc hoặc tìm kiếm lại</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isUrgent = isTaskUrgent(task);
                const currentStaffName = currentUser ? currentUser.fullName : 'Đầu Bếp Ca Trực';
                const isSameOwner =
                  (task.completedById && currentUser?.id && task.completedById === currentUser.id) ||
                  task.completedBy === currentStaffName;
                const isLockedForCurrentUser = task.completed && !isSameOwner;

                return (
                  <div
                    key={task.id}
                    onClick={() => onToggleTask(task.id)}
                    className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl transition-all gap-3 touch-manipulation select-none ${
                      task.completed
                        ? isLockedForCurrentUser
                          ? isUrgent
                            ? 'bg-emerald-50/60 border-2 border-rose-500 shadow-xs cursor-not-allowed'
                            : 'bg-emerald-50/60 border border-emerald-300 shadow-xs cursor-not-allowed'
                          : isUrgent
                          ? 'bg-emerald-50/70 border-2 border-rose-500 hover:bg-emerald-100/60 shadow-xs cursor-pointer active:scale-[0.99]'
                          : 'bg-emerald-50/70 border border-emerald-300 hover:bg-emerald-100/60 shadow-xs cursor-pointer active:scale-[0.99]'
                        : isUrgent
                        ? 'bg-rose-50/40 border-2 border-rose-500 hover:bg-rose-50/70 shadow-xs cursor-pointer active:scale-[0.99]'
                        : 'bg-white hover:bg-stone-50/80 border border-stone-200/90 shadow-xs cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    {/* Left: Checkbox + Title + Completion Time & Date only */}
                    <div className="flex items-start gap-3 sm:gap-3.5 flex-1 w-full">
                      <div className="mt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          disabled={isLockedForCurrentUser}
                          onChange={() => {}} // handled by parent div click
                          className={`w-6 h-6 sm:w-5 sm:h-5 rounded-lg text-emerald-600 border-stone-300 focus:ring-emerald-500 accent-emerald-600 ${
                            isLockedForCurrentUser ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          }`}
                        />
                      </div>

                      <div className="space-y-1 flex-1">
                        <p
                          className={`text-sm sm:text-base font-semibold transition-all ${
                            task.completed
                              ? 'line-through text-stone-400'
                              : isUrgent
                              ? 'text-rose-950 group-hover:text-rose-800'
                              : 'text-stone-900 group-hover:text-amber-900'
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
                    </div>

                    {/* Right: Status */}
                    <div className="text-right shrink-0 self-end sm:self-center">
                      {task.completed ? (
                        <span className="text-xs text-emerald-600 font-bold inline-flex items-center gap-1 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-200">
                          Đã xong
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                            isUrgent
                              ? 'text-rose-700 font-bold bg-rose-100 border border-rose-200'
                              : 'text-stone-400 group-hover:text-amber-700 bg-stone-100'
                          }`}
                        >
                          Chờ thực hiện
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom submit button */}
        <div className="mt-8 pt-5 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-stone-500">
            * Nhấn &quot;Gửi Báo Cáo Ca&quot; để lưu toàn bộ danh sách công việc đã thực hiện vào lịch sử ca bếp.
          </div>
          <button
            onClick={handleSubmit}
            className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-700 hover:to-amber-900 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Xác Nhận & Gửi Báo Cáo Ca Này</span>
          </button>
        </div>
      </div>

      {/* Mobile Sticky Quick Action Bar (md:hidden) */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 px-3.5 py-2.5 bg-stone-900/95 backdrop-blur-md border-t border-amber-900/60 shadow-xl flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center font-extrabold text-amber-300 text-xs shrink-0">
            {progressPercent}%
          </div>
          <div className="text-[11px] leading-tight">
            <span className="font-bold text-white block">{completedTasks}/{totalTasks} việc</span>
            <span className="text-amber-200/80 text-[10px]">Đã hoàn thành</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleManualRefresh}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-xl border border-stone-700 active:scale-95 transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSubmit}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-600/30 flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Nộp Ca</span>
          </button>
        </div>
      </div>
    </div>
  );
};
