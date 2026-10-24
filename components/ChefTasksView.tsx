import React, { useState } from 'react';
import { KitchenTask, TaskCategory, TaskPriority, TaskScheduleType, StaffUser } from '../types.ts';
import {
  ChefHat,
  Plus,
  Trash2,
  ClipboardList,
  Search,
  BellRing,
  Users,
  RotateCcw,
  Edit2,
  Check,
  X,
  Clock,
} from 'lucide-react';

interface ChefTasksViewProps {
  tasks: KitchenTask[];
  onAddTask: (task: Omit<KitchenTask, 'id' | 'completed'>) => void;
  onUpdateTask?: (task: KitchenTask) => void;
  onDeleteTask: (id: string) => void;
  onResetTasks?: () => void;
  onClearAllTasks: () => void;
  onLoadTaskPreset: (type: 'standard' | 'haccp' | 'bakery', mode?: 'append' | 'replace') => void;
  onRestoreEmergencyTasks?: () => void;
  staffList?: StaffUser[];
  currentUser?: StaffUser | null;
  onTriggerManager1430Check?: () => void;
  onTriggerHourlyCheck?: () => void;
}

export const ChefTasksView: React.FC<ChefTasksViewProps> = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onResetTasks,
  onClearAllTasks,
  onLoadTaskPreset,
  onRestoreEmergencyTasks,
  staffList = [],
  currentUser = null,
  onTriggerManager1430Check,
  onTriggerHourlyCheck,
}) => {
  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Sơ chế');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Thường');
  const [taskType, setTaskType] = useState<TaskScheduleType>('daily');
  const [taskShift, setTaskShift] = useState('Tất cả ca');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Inline Edit & Quick Add states in Task List
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTaskType, setEditTaskType] = useState<TaskScheduleType>('daily');
  const [editPriority, setEditPriority] = useState<TaskPriority>('Thường');
  const [editCategory, setEditCategory] = useState<TaskCategory>('Sơ chế');
  const [showQuickAddInline, setShowQuickAddInline] = useState(false);
  const [inlineNewTitle, setInlineNewTitle] = useState('');
  const [inlineNewType, setInlineNewType] = useState<TaskScheduleType>('urgent_today');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Modal xác nhận nạp mẫu việc an toàn (tránh lỡ tay làm mất việc cũ)
  const [presetModal, setPresetModal] = useState<{
    isOpen: boolean;
    type: 'standard' | 'haccp';
    title: string;
    count: number;
    description: string;
  } | null>(null);
  const [confirmReplaceChecked, setConfirmReplaceChecked] = useState(false);

  const hasEmergencySnapshot = (() => {
    try {
      return Boolean(
        localStorage.getItem('kitchen_tasks_emergency_snapshot') ||
        localStorage.getItem('kitchen_admin_auto_backup_latest')
      );
    } catch {
      return false;
    }
  })();

  // Lọc danh sách nhân viên đang hoạt động (online / active)
  const onlineStaffList = staffList.filter((s) => s.status === 'active');

  const handleSelectTaskType = (type: TaskScheduleType) => {
    setTaskType(type);
    if (type === 'urgent_today' && taskPriority === 'Thường') {
      setTaskPriority('Gấp');
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const targetStaff =
      selectedStaffId !== 'all'
        ? onlineStaffList.find((s) => s.id === selectedStaffId)
        : undefined;

    onAddTask({
      title: taskTitle.trim(),
      category: taskCategory,
      priority: taskPriority,
      taskType,
      assignedShift: taskShift,
      assignedStaffId: targetStaff ? targetStaff.id : undefined,
      assignedStaffName: targetStaff ? targetStaff.fullName : undefined,
      createdBy: currentUser?.fullName || 'Trưởng Ca',
      createdByRole: currentUser?.role || 'manager',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
    setTaskTitle('');
  };

  const handleInlineQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineNewTitle.trim()) return;
    onAddTask({
      title: inlineNewTitle.trim(),
      category: 'Sơ chế',
      priority: inlineNewType === 'urgent_today' ? 'Gấp' : 'Thường',
      taskType: inlineNewType,
      assignedShift: 'Tất cả ca',
      createdBy: currentUser?.fullName || 'Trưởng Ca',
      createdByRole: currentUser?.role || 'manager',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
    setInlineNewTitle('');
    setShowQuickAddInline(false);
  };

  const startEditTask = (task: KitchenTask) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditTaskType(task.taskType || 'daily');
    setEditPriority(task.priority || 'Thường');
    setEditCategory(task.category || 'Sơ chế');
  };

  const saveEditTask = (task: KitchenTask) => {
    if (!editTitle.trim() || !onUpdateTask) return;
    onUpdateTask({
      ...task,
      title: editTitle.trim(),
      taskType: editTaskType,
      priority: editTaskType === 'urgent_today' && editPriority === 'Thường' ? 'Gấp' : editPriority,
      category: editCategory,
      createdBy: currentUser?.fullName || task.createdBy || 'Trưởng Ca',
      createdByRole: currentUser?.role || task.createdByRole || 'manager',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
    setEditingTaskId(null);
  };

  const handleToggleUrgent = (task: KitchenTask) => {
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

  const isTaskUrgent = (t: KitchenTask) =>
    (t.taskType || 'daily') === 'urgent_today' || t.priority === 'Gấp' || t.priority === 'Tối khẩn';

  const filteredTasks = tasks
    .filter((t) => {
      const effectiveType = t.taskType || 'daily';
      const matchCat =
        filterCategory === 'all'
          ? true
          : filterCategory === 'daily'
          ? effectiveType === 'daily'
          : filterCategory === 'urgent_today'
          ? effectiveType === 'urgent_today'
          : t.category === filterCategory;
      const matchSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.assignedStaffName && t.assignedStaffName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      const aUrgent = isTaskUrgent(a) ? 1 : 0;
      const bUrgent = isTaskUrgent(b) ? 1 : 0;
      if (bUrgent !== aUrgent) return bUrgent - aUrgent;
      return 0;
    });

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      {/* Header Banner - Bếp Trưởng */}
      <div className="bg-gradient-to-r from-amber-950 via-stone-900 to-amber-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-800/80">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl shadow-lg border border-amber-400/30 text-white">
              <ChefHat className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Phân Hệ @admin & @manager
                </span>
                <span className="text-xs text-stone-300">• {tasks.length} đầu việc đang giao</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {onlineStaffList.length} nhân sự đang Online
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  Tự động báo @manager lúc 14:30
                </span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-amber-50 mt-1">
                Giao Đầu Việc Bếp & Phân Công Nhân Viên
              </h2>
              <p className="text-xs sm:text-sm text-amber-200/80 mt-1 max-w-2xl">
                Phân loại việc <strong>Hàng ngày</strong> và <strong>Việc gấp</strong>. Tự động gửi thông báo lúc <strong>14:30 chiều</strong> cho <code className="font-mono text-amber-300">@manager</code> kiểm tra.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 bg-black/40 p-3 rounded-2xl border border-amber-700/50">
              <div className="text-right">
                <div className="text-xs text-amber-300 font-medium">Tiến độ ca hôm nay:</div>
                <div className="text-lg font-black text-white">
                  {completedCount}/{tasks.length} việc ({tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}%)
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 justify-end">
              {onTriggerHourlyCheck && (
                <button
                  type="button"
                  onClick={onTriggerHourlyCheck}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 transition flex items-center gap-1.5"
                  title="Gửi ngay thông báo chuông nhắc việc còn lại cho toàn ca bếp"
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Nhắc việc còn lại ({Math.max(tasks.length - completedCount, 0)})</span>
                </button>
              )}
              {onTriggerManager1430Check && (
                <button
                  type="button"
                  onClick={onTriggerManager1430Check}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 transition flex items-center gap-1.5"
                  title="Gửi ngay thông báo nhắc kiểm tra 14:30 chiều cho @manager"
                >
                  <BellRing className="w-3.5 h-3.5 text-amber-300" />
                  <span>Báo @manager (14:30)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form giao việc bên trái, danh sách bên phải */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form giao việc */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                Giao Việc & Chỉ Định Nhân Viên Online
              </h3>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 bg-stone-50/70 p-4 rounded-2xl border border-stone-200">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Tên Công Việc Cần Thực Hiện <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ví dụ: Kiểm tra hạn sử dụng thịt bò, Nấu nước dùng phở, Khử khuẩn bồn rửa..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Tuỳ chọn chế độ Checklist */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Phân Loại Công Việc
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTaskType('daily')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                      taskType === 'daily'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <div className="text-xs font-extrabold">
                      <span>Hàng ngày</span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        taskType === 'daily' ? 'text-indigo-100' : 'text-stone-400'
                      }`}
                    >
                      Lặp lại mỗi ca làm việc
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTaskType('urgent_today')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                      taskType === 'urgent_today'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-rose-50/50'
                    }`}
                  >
                    <div className="text-xs font-extrabold">
                      <span>Việc gấp</span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        taskType === 'urgent_today' ? 'text-rose-100' : 'text-stone-400'
                      }`}
                    >
                      Ưu tiên xử lý ngay trong ngày
                    </span>
                  </button>
                </div>
              </div>

              {/* Chỉ định chính xác nhân viên đang Online */}
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-2">
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-950">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    Chỉ Định Nhân Viên Đang Online
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900">
                    Báo về ĐT ngay
                  </span>
                </label>

                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-stone-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="all">Giao chung toàn ca (Ai rảnh làm trước)</option>
                  {onlineStaffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName} [@{staff.role}]
                    </option>
                  ))}
                </select>

                {/* Danh sách nút chọn nhanh nhân viên online */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedStaffId('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                      selectedStaffId === 'all'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-emerald-100/50'
                    }`}
                  >
                    Tất cả
                  </button>
                  {onlineStaffList.map((staff) => (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => setSelectedStaffId(staff.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                        selectedStaffId === staff.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{staff.fullName}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Phân Khu Bếp
                  </label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value as TaskCategory)}
                    className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Sơ chế">Khu Sơ chế</option>
                    <option value="Nấu nướng">Khu Nấu nướng</option>
                    <option value="Vệ sinh">Khu Vệ sinh</option>
                    <option value="Kiểm kê">Khu Kiểm kê</option>
                    <option value="An toàn ATTP">An toàn ATTP</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Độ Ưu Tiên
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Thường">Thường</option>
                    <option value="Gấp">Gấp</option>
                    <option value="Tối khẩn">Tối khẩn</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Áp Dụng Cho Ca
                </label>
                <select
                  value={taskShift}
                  onChange={(e) => setTaskShift(e.target.value)}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="Tất cả ca">Tất cả các ca</option>
                  <option value="Ca Sáng">Ca Sáng (Mở ca)</option>
                  <option value="Ca Chiều">Ca Chiều (Cao điểm)</option>
                  <option value="Ca Đêm">Ca Đêm (Đóng ca & dọn dẹp)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <BellRing className="w-4 h-4" />
                <span>
                  {selectedStaffId === 'all'
                    ? 'Giao Việc & Báo Điện Thoại Toàn Ca'
                    : `Giao Đích Danh & Báo ĐT Cho ${
                        onlineStaffList.find((s) => s.id === selectedStaffId)?.fullName || 'Nhân Viên'
                      }`}
                </span>
              </button>
            </form>

            {/* Quick Templates - Có xác nhận an toàn chống mất việc */}
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <div className="pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                    Nạp mẫu việc theo chuẩn:
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                    🛡️ Chống mất việc
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReplaceChecked(false);
                      setPresetModal({
                        isOpen: true,
                        type: 'standard',
                        title: 'Bếp Tiêu Chuẩn',
                        count: 6,
                        description:
                          'Gồm 6 việc căn bản: đo nhiệt độ tủ, sơ chế rau thịt, nấu nước dùng, bọc màng FIFO, lau bếp, khóa van gas.',
                      });
                    }}
                    className="p-2.5 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 text-left transition flex items-center justify-between group"
                  >
                    <span>Bếp Tiêu Chuẩn (6 việc)</span>
                    <span className="text-[10px] text-stone-400 group-hover:text-stone-700 font-normal">Tùy chọn ➔</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReplaceChecked(false);
                      setPresetModal({
                        isOpen: true,
                        type: 'haccp',
                        title: 'Vệ Sinh An Toàn HACCP',
                        count: 6,
                        description:
                          'Gồm 6 việc an toàn ATTP: kiểm soát nhiệt độ đông sâu, khử khuẩn thớt màu, tem nhãn FIFO, bẫy mỡ...',
                      });
                    }}
                    className="p-2.5 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 text-left transition flex items-center justify-between group"
                  >
                    <span>Vệ Sinh An Toàn HACCP</span>
                    <span className="text-[10px] text-stone-400 group-hover:text-stone-700 font-normal">Tùy chọn ➔</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Danh sách việc đang giao */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-stone-100 gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Danh Sách Đầu Việc Đã Giao ({filteredTasks.length}/{tasks.length})
              </h3>
              <p className="text-xs text-stone-500">
                Việc <strong>Daily</strong> sẽ tự động reset sau 24h kể từ lúc tích xong. Đúng <strong>14:30 chiều</strong> hệ thống tự báo <code className="font-mono">@manager</code> kiểm tra.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onRestoreEmergencyTasks && hasEmergencySnapshot && (
                <button
                  type="button"
                  onClick={onRestoreEmergencyTasks}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 transition shadow-2xs"
                  title="Khôi phục lại danh sách checklist đã lưu trước đó nếu lỡ tay làm mất"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Phục Hồi Việc Đã Mất</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowQuickAddInline(!showQuickAddInline)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tăng Đầu Việc</span>
              </button>

              {currentUser?.role === 'admin' && onResetTasks && (
                confirmResetAll ? (
                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onResetTasks();
                        setConfirmResetAll(false);
                      }}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold"
                    >
                      Xác nhận Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetAll(false)}
                      className="px-2 py-1 text-xs text-stone-600 font-semibold"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetAll(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 flex items-center gap-1 transition"
                    title="Reset toàn bộ tích chọn Checklist về 0% (Chỉ Admin)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Checklist</span>
                  </button>
                )
              )}

              {tasks.length > 0 && (
                confirmClearAll ? (
                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllTasks();
                        setConfirmClearAll(false);
                      }}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold"
                    >
                      Xác nhận xóa hết
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2 py-1 text-xs text-stone-600 font-semibold"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-bold border border-rose-200 transition"
                  >
                    Xóa tất cả
                  </button>
                )
              )}
            </div>
          </div>

          {/* Inline Quick Add Form inside Task List */}
          {showQuickAddInline && (
            <form
              onSubmit={handleInlineQuickAdd}
              className="p-3.5 bg-amber-50/80 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-fadeIn"
            >
              <input
                type="text"
                placeholder="Nhập nhanh đầu việc mới cần tăng cường..."
                value={inlineNewTitle}
                onChange={(e) => setInlineNewTitle(e.target.value)}
                className="flex-1 p-2 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                autoFocus
              />
              <select
                value={inlineNewType}
                onChange={(e) => setInlineNewType(e.target.value as TaskScheduleType)}
                className="p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-stone-800"
              >
                <option value="urgent_today">Việc gấp</option>
                <option value="daily">Hàng ngày</option>
              </select>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowQuickAddInline(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white"
                >
                  Thêm ngay
                </button>
              </div>
            </form>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'daily', label: 'Hàng ngày' },
                { id: 'urgent_today', label: 'Việc gấp' },
                { id: 'Sơ chế', label: 'Sơ chế' },
                { id: 'Nấu nướng', label: 'Nấu nướng' },
                { id: 'Vệ sinh', label: 'Vệ sinh' },
                { id: 'Kiểm kê', label: 'Kiểm kê' },
                { id: 'An toàn ATTP', label: 'An toàn ATTP' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    filterCategory === cat.id
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Tìm việc hoặc người làm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-16 text-stone-400">
                <ClipboardList className="w-12 h-12 mx-auto text-stone-300 mb-2" />
                <p className="text-sm font-semibold text-stone-600">Chưa có đầu việc nào được giao</p>
                <p className="text-xs mt-1 text-stone-400">Hãy thêm công việc ở bảng bên trái hoặc bấm Tăng Đầu Việc.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isUrgent = isTaskUrgent(task);
                const isEditingThis = editingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-2xl transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                      task.completed
                        ? isUrgent
                          ? 'bg-emerald-50/50 border-2 border-rose-500'
                          : 'bg-emerald-50/50 border border-emerald-200'
                        : isUrgent
                        ? 'bg-rose-50/40 border-2 border-rose-500'
                        : 'bg-stone-50 hover:bg-amber-50/30 border border-stone-200'
                    }`}
                  >
                    {isEditingThis ? (
                      <div className="flex-1 w-full bg-white p-3 rounded-xl border-2 border-indigo-400 space-y-2.5">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full p-2 border border-stone-300 rounded-lg text-sm font-semibold text-stone-900 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                            className="p-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-800"
                          >
                            <option value="daily">Hàng ngày</option>
                            <option value="urgent_today">Việc gấp</option>
                          </select>

                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                            className="p-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold text-stone-800"
                          >
                            <option value="Thường">Ưu tiên: Thường</option>
                            <option value="Gấp">Ưu tiên: Gấp</option>
                            <option value="Tối khẩn">Ưu tiên: Tối khẩn</option>
                          </select>

                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as TaskCategory)}
                            className="p-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-800"
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
                              onClick={() => setEditingTaskId(null)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Hủy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditTask(task)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Lưu</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-start gap-2">
                            <span
                              className={`font-semibold text-sm leading-snug ${
                                task.completed
                                  ? 'line-through text-stone-400'
                                  : isUrgent
                                  ? 'text-rose-950'
                                  : 'text-stone-900'
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>

                          {task.completed && task.completedAt && (
                            <div className="text-emerald-700 font-mono text-xs">
                              {task.completedAt}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          {onUpdateTask && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleUrgent(task)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  isUrgent
                                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                                    : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                                }`}
                                title={isUrgent ? 'Chuyển về việc hàng ngày' : 'Đặt làm việc gấp'}
                              >
                                {isUrgent ? 'Hàng ngày' : 'Đặt gấp'}
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditTask(task)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition"
                                title="Chỉnh sửa đầu việc này"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Sửa</span>
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                            title="Xóa đầu việc này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal xác nhận nạp mẫu việc an toàn (Chống mất việc đã tạo) */}
      {presetModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Nạp Mẫu: {presetModal.title}
                </h3>
                <p className="text-xs text-stone-500">
                  Gồm {presetModal.count} đầu việc mẫu chuẩn nghề bếp
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200 leading-relaxed">
              {presetModal.description}
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="text-xs font-bold text-stone-700">
                Chọn cách nạp vào bảng checklist:
              </div>

              {/* Lựa chọn 1: Nạp thêm (An toàn tuyệt đối - Khuyên dùng) */}
              <button
                type="button"
                onClick={() => {
                  onLoadTaskPreset(presetModal.type, 'append');
                  setPresetModal(null);
                }}
                className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500/50 text-left transition flex items-start gap-3 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>➕ Nạp thêm vào danh sách</span>
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded font-semibold">
                      Khuyên Dùng
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Giữ nguyên toàn bộ {tasks.length} việc hiện có, chỉ bổ sung thêm các việc mẫu vào cuối bảng.
                  </div>
                </div>
              </button>

              {/* Lựa chọn 2: Thay thế toàn bộ (Nguy hiểm) */}
              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ⚠️
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-rose-950">
                      Thay thế toàn bộ (Ghi đè)
                    </div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      Xóa toàn bộ {tasks.length} việc hiện có và chỉ giữ lại {presetModal.count} việc mẫu.
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-rose-900 font-semibold pt-1">
                  <input
                    type="checkbox"
                    checked={confirmReplaceChecked}
                    onChange={(e) => setConfirmReplaceChecked(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>Tôi hiểu các việc tự tạo cũ sẽ bị xóa</span>
                </label>

                <button
                  type="button"
                  disabled={!confirmReplaceChecked}
                  onClick={() => {
                    onLoadTaskPreset(presetModal.type, 'replace');
                    setPresetModal(null);
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    confirmReplaceChecked
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xác nhận ghi đè toàn bộ</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPresetModal(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


