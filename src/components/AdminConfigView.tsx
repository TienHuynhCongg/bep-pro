import React, { useState } from 'react';
import { AppConfig, NavItem, NavItemType } from '../types.ts';
import { DynamicIcon, AVAILABLE_ICONS } from './DynamicIcon.tsx';
import {
  Sliders,
  Menu,
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
  Save,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AdminConfigViewProps {
  appConfig: AppConfig;
  onUpdateAppConfig: (config: AppConfig) => void;
  navItems: NavItem[];
  onUpdateNavItems: (items: NavItem[]) => void;
}

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({
  appConfig,
  onUpdateAppConfig,
  navItems,
  onUpdateNavItems,
}) => {
  // Branding state
  const [brandingForm, setBrandingForm] = useState<AppConfig>(appConfig);
  const [brandingSaved, setBrandingSaved] = useState(false);

  // Nav Edit state
  const [editingNavId, setEditingNavId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('ListChecks');
  const [editType, setEditType] = useState<NavItemType>('checklist');
  const [editCustomTitle, setEditCustomTitle] = useState('');
  const [editCustomContent, setEditCustomContent] = useState('');

  // Add Nav state
  const [newNavLabel, setNewNavLabel] = useState('');
  const [newNavIcon, setNewNavIcon] = useState('Sparkles');
  const [newNavType, setNewNavType] = useState<NavItemType>('custom');
  const [newNavCustomTitle, setNewNavCustomTitle] = useState('');
  const [newNavCustomContent, setNewNavCustomContent] = useState('');
  const [isAddingNav, setIsAddingNav] = useState(false);
  const [isNavListExpanded, setIsNavListExpanded] = useState(false);

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAppConfig(brandingForm);
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 2500);
  };

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

  const handleResetNavItems = () => {
    if (window.confirm('Khôi phục thanh công cụ về mặc định ban đầu?')) {
      const defaultNav: NavItem[] = [
        { id: 'nav-checklist', label: 'Checklist Nhân Viên', iconName: 'ListChecks', targetType: 'checklist', visible: true, colorTheme: 'amber' },
        { id: 'nav-history', label: 'Lịch Sử Ca', iconName: 'Archive', targetType: 'history', visible: true, colorTheme: 'emerald' },
        { id: 'nav-analytics', label: 'Thống Kê Ca', iconName: 'BarChart3', targetType: 'analytics', visible: true, colorTheme: 'blue' },
        { id: 'nav-chef-tasks', label: 'Giao Việc Bếp Trưởng', iconName: 'ChefHat', targetType: 'chef_tasks', visible: true, colorTheme: 'amber' },
        { id: 'nav-staff', label: 'Quản Lý Nhân Sự', iconName: 'UserCheck', targetType: 'staff', visible: true, colorTheme: 'purple' },
        { id: 'nav-admin', label: 'Cấu Hình Admin', iconName: 'Sliders', targetType: 'admin', visible: true, colorTheme: 'amber' },
      ];
      onUpdateNavItems(defaultNav);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner - Admin Hệ Thống */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 bg-gradient-to-br from-stone-600 to-stone-800 rounded-2xl shadow-lg border border-stone-500/30 text-white">
              <Sliders className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Phân Hệ Quản Trị Hệ Thống (Admin)
                </span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-white mt-1">
                Cấu Hình Thanh Công Cụ & Ứng Dụng
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-2xl">
                Tự do thay đổi thanh công cụ (thêm, bớt, đổi tên từng nút, thay icon), sắp xếp thứ tự và cấu hình tên thương hiệu nhà hàng.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card: Tùy biến thanh công cụ */}
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-stone-100 gap-3">
          <div>
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Menu className="w-5 h-5 text-amber-600" />
              Quản Lý Từng Nút Trên Thanh Công Cụ (Navbar)
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Thêm bớt, đổi tên, thay đổi biểu tượng icon và sắp xếp thứ tự các nút trên thanh menu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetNavItems}
              className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl border border-stone-200 font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục mặc định</span>
            </button>
            <button
              onClick={() => setIsAddingNav(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Nút Mới Vào Menu</span>
            </button>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="bg-stone-900 text-white p-4 sm:p-5 rounded-2xl border border-stone-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Xem trước thanh công cụ trực tiếp (Live Preview):
          </div>
          <div className="flex flex-wrap items-center gap-2 p-2 bg-stone-950/80 rounded-xl border border-stone-800">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-700/90 text-white flex items-center gap-1.5 shadow-sm border border-amber-500/40"
                >
                  <DynamicIcon name={item.iconName} className="w-3.5 h-3.5 text-amber-200" />
                  <span>{item.label}</span>
                </div>
              ))}
          </div>
        </div>

        {/* List of Current Toolbar Items (Collapsible Dropdown) */}
        <div className="border border-stone-200 rounded-2xl overflow-hidden bg-stone-50/40">
          <button
            type="button"
            onClick={() => setIsNavListExpanded(!isNavListExpanded)}
            className="w-full px-4 py-3.5 bg-stone-100/80 hover:bg-stone-200/60 transition flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Danh sách các nút hiện tại trên thanh công cụ ({navItems.length} nút)
              </span>
              {!isNavListExpanded && (
                <div className="flex items-center gap-1 ml-1">
                  {navItems.map((item) => (
                    <span
                      key={item.id}
                      className={`p-1.5 rounded-lg border ${
                        item.visible
                          ? 'bg-amber-100 text-amber-900 border-amber-200'
                          : 'bg-stone-200 text-stone-400 border-stone-300 opacity-60'
                      }`}
                      title={`${item.label} (${item.visible ? 'Đang hiện' : 'Đang ẩn'})`}
                    >
                      <DynamicIcon name={item.iconName} className="w-3.5 h-3.5" />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-xl border border-amber-200 shrink-0">
              <span>{isNavListExpanded ? 'Thu gọn' : 'Mở danh sách'}</span>
              {isNavListExpanded ? (
                <ChevronUp className="w-4 h-4 text-amber-700" />
              ) : (
                <ChevronDown className="w-4 h-4 text-amber-700" />
              )}
            </div>
          </button>

          {isNavListExpanded && (
            <div className="divide-y divide-stone-100 border-t border-stone-200">
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
                              <option value="chef_tasks">Mở Giao Việc Bếp Trưởng</option>
                              <option value="history">Mở Lịch Sử Báo Cáo Ca</option>
                              <option value="analytics">Mở Thống Kê & Báo Cáo</option>
                              <option value="staff">Mở Quản Lý Nhân Sự</option>
                              <option value="admin">Mở Cấu Hình Admin</option>
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
          )}
        </div>

        {/* Modal: Thêm nút mới */}
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
                    <option value="chef_tasks">Mở Giao Việc Bếp Trưởng</option>
                    <option value="history">Mở Lịch Sử Ca Bếp</option>
                    <option value="analytics">Mở Báo Cáo & Thống Kê</option>
                    <option value="staff">Mở Quản Lý Nhân Sự</option>
                    <option value="admin">Mở Cấu Hình Admin</option>
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
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6 sm:p-8">
        <h3 className="text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          Tùy Chỉnh Thương Hiệu Bếp & Tiêu Đề Header
        </h3>
        <p className="text-xs text-stone-500 mb-5">
          Thay đổi tên nhà hàng và khẩu hiệu hiển thị ở góc trái trên cùng thanh công cụ.
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
              className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu Tên Thương Hiệu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
