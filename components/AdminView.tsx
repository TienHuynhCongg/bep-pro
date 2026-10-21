import React, { useState } from 'react';
import { AppConfig, DynamicField, KitchenTask, NavItem, NavItemType, TaskCategory, TaskPriority } from '../types.ts';
import { DynamicIcon, AVAILABLE_ICONS } from './DynamicIcon.tsx';
import {
  Sliders,
  Menu,
  ListPlus,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  Layers,
  ChefHat,
  Flame,
  Utensils,
  ClipboardList,
  Save,
  HelpCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface AdminViewProps {
  appConfig: AppConfig;
  onUpdateAppConfig: (config: AppConfig) => void;
  navItems: NavItem[];
  onUpdateNavItems: (items: NavItem[]) => void;
  tasks: KitchenTask[];
  onAddTask: (task: Omit<KitchenTask, 'id' | 'completed'>) => void;
  onDeleteTask: (id: string) => void;
  onClearAllTasks: () => void;
  onLoadTaskPreset: (type: 'standard' | 'haccp' | 'bakery') => void;
  schema: DynamicField[];
  onAddField: (field: Omit<DynamicField, 'id'>) => void;
  onDeleteField: (id: string) => void;
  initialSubTab?: 'nav' | 'tasks' | 'schema';
}

export const AdminView: React.FC<AdminViewProps> = ({
  appConfig,
  onUpdateAppConfig,
  navItems,
  onUpdateNavItems,
  tasks,
  onAddTask,
  onDeleteTask,
  onClearAllTasks,
  onLoadTaskPreset,
  schema,
  onAddField,
  onDeleteField,
  initialSubTab = 'nav',
}) => {
  const [adminSubTab, setAdminSubTab] = useState<'nav' | 'tasks' | 'schema'>(initialSubTab);

  // --- BRANDING STATE ---
  const [brandingForm, setBrandingForm] = useState<AppConfig>(appConfig);
  const [brandingSaved, setBrandingSaved] = useState(false);

  // --- NAV EDIT STATE ---
  const [editingNavId, setEditingNavId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('ListChecks');
  const [editType, setEditType] = useState<NavItemType>('checklist');
  const [editCustomTitle, setEditCustomTitle] = useState('');
  const [editCustomContent, setEditCustomContent] = useState('');

  // --- ADD NAV STATE ---
  const [newNavLabel, setNewNavLabel] = useState('');
  const [newNavIcon, setNewNavIcon] = useState('Sparkles');
  const [newNavType, setNewNavType] = useState<NavItemType>('custom');
  const [newNavCustomTitle, setNewNavCustomTitle] = useState('');
  const [newNavCustomContent, setNewNavCustomContent] = useState('');
  const [isAddingNav, setIsAddingNav] = useState(false);

  // --- TASK FORM STATE ---
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Sơ chế');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Thường');
  const [taskShift, setTaskShift] = useState('Tất cả ca');

  // --- FIELD FORM STATE ---
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<DynamicField['type']>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldOptionsText, setFieldOptionsText] = useState('');

  // Handle Save Branding
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAppConfig(brandingForm);
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 2500);
  };

  // Nav Item Actions
  const handleToggleNavVisibility = (id: string) => {
    const updated = navItems.map((item) =>
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    onUpdateNavItems(updated);
  };

  const handleMoveNav = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= navItems.length) return;
    const cloned = [...navItems];
    const [moved] = cloned.splice(index, 1);
    cloned.splice(targetIndex, 0, moved);
    onUpdateNavItems(cloned);
  };

  const handleDeleteNav = (id: string) => {
    if (navItems.length <= 1) {
      alert('Thanh công cụ cần có ít nhất 1 nút!');
      return;
    }
    if (window.confirm('Bạn có chắc chắn muốn xóa nút này khỏi thanh công cụ?')) {
      const updated = navItems.filter((i) => i.id !== id);
      onUpdateNavItems(updated);
    }
  };

  const startEditNav = (item: NavItem) => {
    setEditingNavId(item.id);
    setEditLabel(item.label);
    setEditIcon(item.iconName);
    setEditType(item.targetType);
    setEditCustomTitle(item.customTitle || item.label);
    setEditCustomContent(item.customContent || '');
  };

  const saveEditNav = () => {
    if (!editLabel.trim()) return;
    const updated = navItems.map((item) =>
      item.id === editingNavId
        ? {
            ...item,
            label: editLabel.trim(),
            iconName: editIcon,
            targetType: editType,
            customTitle: editCustomTitle || editLabel.trim(),
            customContent: editCustomContent,
          }
        : item
    );
    onUpdateNavItems(updated);
    setEditingNavId(null);
  };

  const handleAddNewNavItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNavLabel.trim()) return;

    const newId = `nav-custom-${Date.now()}`;
    const newItem: NavItem = {
      id: newId,
      label: newNavLabel.trim(),
      iconName: newNavIcon,
      targetType: newNavType,
      visible: true,
      colorTheme: 'amber',
      customTitle: newNavCustomTitle || newNavLabel.trim(),
      customContent:
        newNavCustomContent ||
        'Nội dung tài liệu, quy trình hướng dẫn, hoặc quy định làm việc của mục này do Quản lý thiết lập.',
    };

    onUpdateNavItems([...navItems, newItem]);
    setNewNavLabel('');
    setNewNavCustomTitle('');
    setNewNavCustomContent('');
    setIsAddingNav(false);
  };

  // Reset Nav Items
  const handleResetNavItems = () => {
    if (window.confirm('Khôi phục thanh công cụ về mặc định ban đầu?')) {
      const defaultNav: NavItem[] = [
        { id: 'nav-checklist', label: 'Checklist Nhân Viên', iconName: 'ListChecks', targetType: 'checklist', visible: true, colorTheme: 'amber' },
        { id: 'nav-history', label: 'Lịch Sử Ca', iconName: 'Archive', targetType: 'history', visible: true, colorTheme: 'emerald' },
        { id: 'nav-analytics', label: 'Thống Kê Ca', iconName: 'BarChart3', targetType: 'analytics', visible: true, colorTheme: 'blue' },
        { id: 'nav-admin', label: 'Gửi Đầu Việc (Admin)', iconName: 'Sliders', targetType: 'admin', visible: true, colorTheme: 'amber' },
      ];
      onUpdateNavItems(defaultNav);
    }
  };

  // Add Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask({
      title: taskTitle.trim(),
      category: taskCategory,
      priority: taskPriority,
      assignedShift: taskShift,
    });
    setTaskTitle('');
  };

  // Add Field
  const handleCreateField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;

    const opts =
      fieldType === 'select'
        ? fieldOptionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    onAddField({
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      placeholder: fieldPlaceholder.trim(),
      options: opts,
      width: fieldType === 'textarea' ? 'full' : 'half',
    });

    setFieldLabel('');
    setFieldPlaceholder('');
    setFieldOptionsText('');
    setFieldRequired(false);
  };

  return (
    <div className="space-y-6">
      {/* Admin Notice Header */}
      <div className="bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950 text-white rounded-2xl p-6 shadow-md border border-amber-800/80">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-600 rounded-xl shadow-inner text-amber-100">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-100 flex items-center gap-2">
                Bảng Điều Khiển Quản Lý Bếp (Admin Portal)
              </h2>
              <p className="text-xs sm:text-sm text-amber-200/80 mt-0.5">
                Tự do thay đổi thanh công cụ (thêm, bớt, đổi tên nút), giao đầu việc hàng ngày cho nhân viên và cấu hình mẫu báo cáo ca.
              </p>
            </div>
          </div>

          {/* Sub Navigation in Admin */}
          <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-amber-700/50 w-full sm:w-auto">
            <button
              onClick={() => setAdminSubTab('nav')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 flex-1 sm:flex-initial ${
                adminSubTab === 'nav'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Menu className="w-3.5 h-3.5" />
              <span>1. Thanh Công Cụ (Navbar)</span>
            </button>

            <button
              onClick={() => setAdminSubTab('tasks')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 flex-1 sm:flex-initial ${
                adminSubTab === 'tasks'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>2. Giao List Việc ({tasks.length})</span>
            </button>

            <button
              onClick={() => setAdminSubTab('schema')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 flex-1 sm:flex-initial ${
                adminSubTab === 'schema'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>3. Mẫu Thông Tin ({schema.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================== SUB-TAB 1: CẤU HÌNH THANH CÔNG CỤ (NAVBAR) ===================== */}
      {adminSubTab === 'nav' && (
        <div className="space-y-6">
          {/* Main Card: Tùy biến thanh công cụ */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-6 border-b border-stone-100 gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Menu className="w-5 h-5 text-amber-600" />
                  Quản Lý & Tùy Biến Thanh Công Cụ (Navbar Items)
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  Bạn có thể <strong>thay đổi tên từng nút</strong>, <strong>thêm nút mới</strong>, <strong>ẩn/hiện hoặc xóa nút</strong>, và <strong>sắp xếp lại thứ tự</strong> hiển thị trên thanh menu trên cùng.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetNavItems}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg border border-stone-200 font-medium flex items-center gap-1 transition"
                  title="Khôi phục thanh menu gốc"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Khôi phục mặc định</span>
                </button>
                <button
                  onClick={() => setIsAddingNav(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Nút Mới Vào Thanh Công Cụ</span>
                </button>
              </div>
            </div>

            {/* Live Preview Box of the Toolbar */}
            <div className="mb-6 bg-stone-900 text-white p-4 rounded-xl border border-stone-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Xem trước thanh công cụ trực tiếp (Live Preview):
              </div>
              <div className="flex flex-wrap items-center gap-2 p-2 bg-stone-950/80 rounded-lg border border-stone-800">
                {navItems
                  .filter((item) => item.visible)
                  .map((item, idx) => (
                    <div
                      key={item.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-700/90 text-white flex items-center gap-1.5 shadow-sm border border-amber-500/40"
                    >
                      <DynamicIcon name={item.iconName} className="w-3.5 h-3.5 text-amber-200" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                {navItems.filter((item) => item.visible).length === 0 && (
                  <span className="text-xs text-stone-500 italic">Tất cả nút đang bị ẩn</span>
                )}
              </div>
            </div>

            {/* List of Current Toolbar Items */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Danh sách các nút hiện tại trên thanh công cụ ({navItems.length} nút):
              </h4>

              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-stone-50/40">
                {navItems.map((item, index) => {
                  const isEditing = editingNavId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 transition ${
                        item.visible ? 'bg-white hover:bg-amber-50/20' : 'bg-stone-100/60 opacity-60'
                      }`}
                    >
                      {isEditing ? (
                        /* Edit Form Inline */
                        <div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 uppercase">Chỉnh sửa nút:</span>
                            <button
                              onClick={() => setEditingNavId(null)}
                              className="text-stone-400 hover:text-stone-700 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-stone-700 mb-1">
                                Tên hiển thị trên thanh công cụ
                              </label>
                              <input
                                type="text"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="w-full p-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="Nhập tên mới..."
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-stone-700 mb-1">
                                Biểu tượng (Icon)
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-amber-100 rounded-lg border border-amber-300">
                                  <DynamicIcon name={editIcon} className="w-5 h-5 text-amber-800" />
                                </div>
                                <select
                                  value={editIcon}
                                  onChange={(e) => setEditIcon(e.target.value)}
                                  className="w-full p-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                  {AVAILABLE_ICONS.map((ic) => (
                                    <option key={ic} value={ic}>
                                      {ic}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Target selection */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-stone-700 mb-1">
                                Chức năng liên kết khi bấm
                              </label>
                              <select
                                value={editType}
                                onChange={(e) => setEditType(e.target.value as NavItemType)}
                                className="w-full p-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                              >
                                <option value="checklist">Mở Bảng Checklist Nhân Viên</option>
                                <option value="history">Mở Lịch Sử Báo Cáo Ca</option>
                                <option value="analytics">Mở Thống Kê & Báo Cáo</option>
                                <option value="staff">Quản Lý Nhân Sự Bếp</option>
                                <option value="admin">Mở Bảng Quản Trị (Admin)</option>
                                <option value="custom">Trang Tùy Chỉnh (Nội quy/Quy trình riêng)</option>
                              </select>
                            </div>

                            {editType === 'custom' && (
                              <div>
                                <label className="block text-xs font-bold text-stone-700 mb-1">
                                  Tiêu đề trang chi tiết
                                </label>
                                <input
                                  type="text"
                                  value={editCustomTitle}
                                  onChange={(e) => setEditCustomTitle(e.target.value)}
                                  className="w-full p-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                  placeholder="Tiêu đề trang..."
                                />
                              </div>
                            )}
                          </div>

                          {editType === 'custom' && (
                            <div>
                              <label className="block text-xs font-bold text-stone-700 mb-1">
                                Nội dung hướng dẫn / quy trình chi tiết (Văn bản)
                              </label>
                              <textarea
                                rows={3}
                                value={editCustomContent}
                                onChange={(e) => setEditCustomContent(e.target.value)}
                                className="w-full p-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="Ghi chú quy trình thực hiện, nội quy làm việc hoặc danh sách kiểm tra cần lưu ý..."
                              />
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingNavId(null)}
                              className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={saveEditNav}
                              className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1 shadow-sm"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Lưu thay đổi</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal Row View */
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => handleMoveNav(index, 'up')}
                                disabled={index === 0}
                                className={`p-1 rounded hover:bg-stone-200 ${
                                  index === 0 ? 'text-stone-300 cursor-not-allowed' : 'text-stone-600'
                                }`}
                                title="Di chuyển lên trước"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveNav(index, 'down')}
                                disabled={index === navItems.length - 1}
                                className={`p-1 rounded hover:bg-stone-200 ${
                                  index === navItems.length - 1
                                    ? 'text-stone-300 cursor-not-allowed'
                                    : 'text-stone-600'
                                }`}
                                title="Di chuyển xuống sau"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="p-2.5 bg-amber-100 text-amber-900 rounded-xl border border-amber-200">
                              <DynamicIcon name={item.iconName} className="w-5 h-5" />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-stone-900">{item.label}</span>
                                {!item.visible && (
                                  <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                                    Đang ẩn
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                                <span className="font-mono text-[11px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                                  Loại: {item.targetType}
                                </span>
                                <span>•</span>
                                <span>Icon: {item.iconName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              onClick={() => handleToggleNavVisibility(item.id)}
                              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
                                item.visible
                                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                              }`}
                              title={item.visible ? 'Bấm để ẩn nút này' : 'Bấm để hiện nút này'}
                            >
                              {item.visible ? (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-stone-500" />
                                  <span>Đang hiện</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Hiện lại</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => startEditNav(item)}
                              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-amber-200 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Đổi tên & Icon</span>
                            </button>

                            <button
                              onClick={() => handleDeleteNav(item.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition"
                              title="Xóa nút này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal / Form: Thêm nút mới vào thanh công cụ */}
            {isAddingNav && (
              <div className="mt-6 bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 rounded-2xl border-2 border-dashed border-amber-300 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-950 uppercase flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-600" /> Thêm Nút Mới Vào Thanh Công Cụ
                  </h4>
                  <button
                    onClick={() => setIsAddingNav(false)}
                    className="text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddNewNavItem} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Tên Nút Hiển Thị <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Kiểm Kê Kho, Sổ Tay Bếp, Quy Trình ATTP..."
                        value={newNavLabel}
                        onChange={(e) => setNewNavLabel(e.target.value)}
                        className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Chức Năng Khi Bấm Vào Nút
                      </label>
                      <select
                        value={newNavType}
                        onChange={(e) => setNewNavType(e.target.value as NavItemType)}
                        className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="custom">Trang Tùy Chỉnh (Nội quy, checklist hoặc ghi chú riêng)</option>
                        <option value="checklist">Mở Bảng Checklist Nhân Viên</option>
                        <option value="history">Mở Lịch Sử Ca Bếp</option>
                        <option value="analytics">Mở Báo Cáo & Thống Kê</option>
                        <option value="staff">Quản Lý Nhân Sự</option>
                        <option value="admin">Mở Bảng Admin</option>
                      </select>
                    </div>
                  </div>

                  {/* Icon Selector Grid */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Chọn Biểu Tượng (Icon) Cho Nút
                    </label>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 p-2 bg-white rounded-xl border border-stone-200 max-h-36 overflow-y-auto">
                      {AVAILABLE_ICONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewNavIcon(ic)}
                          className={`p-2 rounded-lg flex items-center justify-center transition ${
                            newNavIcon === ic
                              ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-700'
                          }`}
                          title={ic}
                        >
                          <DynamicIcon name={ic} className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {newNavType === 'custom' && (
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-stone-200">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Tiêu Đề Trang Tùy Chỉnh
                        </label>
                        <input
                          type="text"
                          placeholder="Tiêu đề hiển thị khi mở trang này..."
                          value={newNavCustomTitle}
                          onChange={(e) => setNewNavCustomTitle(e.target.value)}
                          className="w-full p-2 text-sm bg-stone-50 border border-stone-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Nội Dung Chi Tiết / Hướng Dẫn Vận Hành
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Nhập nội dung quy định bếp, quy chuẩn vệ sinh, hướng dẫn sử dụng máy móc..."
                          value={newNavCustomContent}
                          onChange={(e) => setNewNavCustomContent(e.target.value)}
                          className="w-full p-2 text-sm bg-stone-50 border border-stone-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNav(false)}
                      className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md transition flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Xác Nhận Thêm Vào Menu</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Card: Tùy biến Tên Nhà Hàng / App Branding */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <h3 className="text-base font-bold text-stone-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Tùy Chỉnh Tên Ứng Dụng & Thương Hiệu Bếp Trên Header
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Thay đổi tên thương hiệu và khẩu hiệu hiển thị ở góc trái trên cùng thanh công cụ.
            </p>

            <form onSubmit={handleSaveBranding} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Tên Ứng Dụng / Nhà Hàng (App Title)
                  </label>
                  <input
                    type="text"
                    required
                    value={brandingForm.appTitle}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, appTitle: e.target.value })
                    }
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Khẩu Hiệu / Mô Tả Phụ (Subtitle)
                  </label>
                  <input
                    type="text"
                    value={brandingForm.appSubtitle}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, appSubtitle: e.target.value })
                    }
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Logo Biểu Tượng Bếp
                  </label>
                  <select
                    value={brandingForm.brandIcon}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, brandIcon: e.target.value })
                    }
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Utensils">Dao Nĩa (Utensils)</option>
                    <option value="ChefHat">Nón Bếp Trưởng (ChefHat)</option>
                    <option value="Flame">Ngọn Lửa Bếp (Flame)</option>
                    <option value="Coffee">Cà Phê (Coffee)</option>
                    <option value="Soup">Tô Súp (Soup)</option>
                    <option value="ShieldCheck">An Toàn ATTP (ShieldCheck)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {brandingSaved ? (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Đã cập nhật tên thương hiệu thành công!
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Tên Thương Hiệu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== SUB-TAB 2: GIAO DANH SÁCH ĐẦU VIỆC BẾP ===================== */}
      {adminSubTab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form thêm đầu việc */}
          <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Thêm Đầu Việc Giao Nhân Viên
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-3.5 bg-stone-50/70 p-4 rounded-xl border border-stone-200">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Tên Công Việc Cần Làm <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ví dụ: Kiểm tra hạn sử dụng thịt bò, Làm sạch bộ lọc dầu mỡ..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                    Phân Khu Bếp
                  </label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value as TaskCategory)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Sơ chế">Sơ chế</option>
                    <option value="Nấu nướng">Nấu nướng</option>
                    <option value="Vệ sinh">Vệ sinh</option>
                    <option value="Kiểm kê">Kiểm kê & Bảo quản</option>
                    <option value="An toàn ATTP">An toàn ATTP</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                    Độ Ưu Tiên
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Thường">Thường</option>
                    <option value="Gấp">Gấp</option>
                    <option value="Tối khẩn">Tối khẩn 🔥</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Áp Dụng Cho Ca
                </label>
                <select
                  value={taskShift}
                  onChange={(e) => setTaskShift(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="Tất cả ca">Tất cả các ca</option>
                  <option value="Ca Sáng">Ca Sáng (Mở ca)</option>
                  <option value="Ca Chiều">Ca Chiều (Cao điểm)</option>
                  <option value="Ca Đêm">Ca Đêm (Đóng ca & dọn dẹp)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Giao Đầu Việc Này Vào Checklist</span>
              </button>
            </form>

            {/* Quick Templates */}
            <div className="pt-2 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">
                Nạp mẫu danh mục việc nhanh:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onLoadTaskPreset('standard')}
                  className="p-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl border border-stone-200 text-left transition"
                >
                  🍽️ Bếp Tiêu Chuẩn (6 việc)
                </button>
                <button
                  type="button"
                  onClick={() => onLoadTaskPreset('haccp')}
                  className="p-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl border border-stone-200 text-left transition"
                >
                  🛡️ Vệ Sinh An Toàn HACCP
                </button>
              </div>
            </div>
          </div>

          {/* Danh sách đầu việc đang có */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Danh Sách Đầu Việc Đã Giao ({tasks.length} mục)
                </h3>
                <p className="text-xs text-stone-500">Các mục này sẽ tự động hiện trên màn hình Checklist của nhân viên.</p>
              </div>

              {tasks.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Bạn có chắc muốn xóa TẤT CẢ các đầu việc này?')) {
                      onClearAllTasks();
                    }
                  }}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                >
                  Xóa tất cả việc
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <ClipboardList className="w-10 h-10 mx-auto text-stone-300 mb-2" />
                  <p className="text-sm">Chưa có đầu việc nào được giao.</p>
                  <p className="text-xs mt-1">Hãy thêm ở khung bên trái hoặc nạp mẫu nhanh.</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-stone-50 hover:bg-amber-50/30 rounded-xl border border-stone-200 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-stone-900 text-sm leading-snug">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-medium">
                          {task.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            task.priority === 'Gấp'
                              ? 'bg-amber-100 text-amber-800'
                              : task.priority === 'Tối khẩn'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {task.priority}
                        </span>
                        {task.assignedShift && (
                          <span className="text-stone-400">• {task.assignedShift}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition"
                      title="Xóa đầu việc này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUB-TAB 3: CẤU HÌNH TRƯỜNG DỮ LIỆU CA ===================== */}
      {adminSubTab === 'schema' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Thêm Trường Thông Tin Ca Làm
            </h3>
            <p className="text-xs text-stone-500">
              Cấu hình các ô nhập liệu cho nhân viên (Nhiệt độ tủ lạnh, số lượng thịt hủy, trưởng ca, ghi chú...)
            </p>

            <form onSubmit={handleCreateField} className="space-y-3.5 bg-stone-50/70 p-4 rounded-xl border border-stone-200">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Tên Trường (Label) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nhiệt độ lò nướng, Tên Bếp Phó, Tiêu thụ gas..."
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                    Loại Ô Nhập
                  </label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as DynamicField['type'])}
                    className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="text">Chữ ngắn (Text)</option>
                    <option value="number">Số lượng (Number)</option>
                    <option value="textarea">Ghi chú dài (Textarea)</option>
                    <option value="select">Danh sách chọn (Dropdown)</option>
                    <option value="date">Ngày tháng (Date)</option>
                    <option value="time">Giờ (Time)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                    Bắt Buộc Nhập?
                  </label>
                  <select
                    value={fieldRequired ? 'true' : 'false'}
                    onChange={(e) => setFieldRequired(e.target.value === 'true')}
                    className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="false">Không bắt buộc</option>
                    <option value="true">Bắt buộc (Required *)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Gợi Ý Placeholder
                </label>
                <input
                  type="text"
                  placeholder="Nhập chữ gợi ý mờ..."
                  value={fieldPlaceholder}
                  onChange={(e) => setFieldPlaceholder(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {fieldType === 'select' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                    Các Phương Án Lựa Chọn (Mỗi dòng một mục)
                  </label>
                  <textarea
                    rows={3}
                    placeholder={'Ca Sáng\nCa Chiều\nCa Tối'}
                    value={fieldOptionsText}
                    onChange={(e) => setFieldOptionsText(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Trường Này Vào Mẫu Ca</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">
              Các Trường Đang Sử Dụng Trong Ca ({schema.length} trường)
            </h3>

            <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
              {schema.map((f) => (
                <div
                  key={f.id}
                  className="p-3.5 bg-white hover:bg-stone-50 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">{f.label}</span>
                      {f.required && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          Bắt buộc
                        </span>
                      )}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      Kiểu: <span className="font-mono text-stone-600">{f.type}</span>
                      {f.options && f.options.length > 0 && ` • (${f.options.length} lựa chọn)`}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm(`Xóa trường "${f.label}" khỏi mẫu ca?`)) {
                        onDeleteField(f.id);
                      }
                    }}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition"
                    title="Xóa trường này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
