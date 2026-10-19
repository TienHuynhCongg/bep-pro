import React, { useState } from 'react';
import { NavItem, NavItemType } from '../types.ts';
import { DynamicIcon, AVAILABLE_ICONS } from './DynamicIcon.tsx';
import {
  X,
  Settings2,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface NavConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  onUpdateNavItems: (items: NavItem[]) => void;
  onOpenFullAdmin: () => void;
}

export const NavConfigModal: React.FC<NavConfigModalProps> = ({
  isOpen,
  onClose,
  navItems,
  onUpdateNavItems,
  onOpenFullAdmin,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('ListChecks');
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('Sparkles');
  const [newType, setNewType] = useState<NavItemType>('custom');

  if (!isOpen) return null;

  const handleToggleVisible = (id: string) => {
    onUpdateNavItems(
      navItems.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    );
  };

  const handleMove = (index: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= navItems.length) return;
    const cloned = [...navItems];
    const [moved] = cloned.splice(index, 1);
    cloned.splice(targetIdx, 0, moved);
    onUpdateNavItems(cloned);
  };

  const handleDelete = (id: string) => {
    if (navItems.length <= 1) {
      alert('Thanh công cụ cần tối thiểu 1 nút!');
      return;
    }
    if (window.confirm('Bạn có chắc chắn muốn xóa nút này khỏi thanh menu?')) {
      onUpdateNavItems(navItems.filter((item) => item.id !== id));
    }
  };

  const startEdit = (item: NavItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditIcon(item.iconName);
  };

  const saveEdit = () => {
    if (!editLabel.trim()) return;
    onUpdateNavItems(
      navItems.map((item) =>
        item.id === editingId
          ? { ...item, label: editLabel.trim(), iconName: editIcon }
          : item
      )
    );
    setEditingId(null);
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const newItem: NavItem = {
      id: `nav-${Date.now()}`,
      label: newLabel.trim(),
      iconName: newIcon,
      targetType: newType,
      visible: true,
      colorTheme: 'amber',
      customTitle: newLabel.trim(),
      customContent: 'Nội dung quy trình hướng dẫn của mục này...',
    };
    onUpdateNavItems([...navItems, newItem]);
    setNewLabel('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 to-stone-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600 rounded-lg text-amber-100">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-amber-50">
                Tùy Biến Thanh Công Cụ (Toolbar Manager)
              </h3>
              <p className="text-xs text-amber-200/80">
                Thêm bớt, đổi tên và sắp xếp vị trí các nút trên thanh menu chính
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Action bar */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Các nút hiện có ({navItems.length}):
            </span>
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Nút Mới</span>
            </button>
          </div>

          {/* Add form */}
          {isAdding && (
            <form onSubmit={handleAddNew} className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase">Thêm Nút Vào Menu:</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Tên Nút Hiển Thị</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Kiểm Kê Kho, Sổ Giao Ca..."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Chức Năng</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as NavItemType)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="custom">Trang Ghi Chú / Nội Quy Riêng</option>
                    <option value="checklist">Checklist Nhân Viên</option>
                    <option value="chef_tasks">Giao Việc Bếp Trưởng</option>
                    <option value="history">Lịch Sử Ca</option>
                    <option value="analytics">Thống Kê</option>
                    <option value="staff">Quản Lý Nhân Sự</option>
                    <option value="admin">Cấu Hình Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Chọn Icon</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-stone-200 max-h-24 overflow-y-auto">
                  {AVAILABLE_ICONS.slice(0, 16).map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewIcon(ic)}
                      className={`p-1.5 rounded flex items-center justify-center transition ${
                        newIcon === ic ? 'bg-amber-600 text-white' : 'hover:bg-stone-100 text-stone-700'
                      }`}
                      title={ic}
                    >
                      <DynamicIcon name={ic} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-200 rounded"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-bold bg-amber-600 text-white rounded hover:bg-amber-700"
                >
                  Thêm Nút
                </button>
              </div>
            </form>
          )}

          {/* List items */}
          <div className="space-y-2">
            {navItems.map((item, index) => {
              const isEditing = editingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition ${
                    item.visible ? 'bg-stone-50 border-stone-200' : 'bg-stone-100 opacity-60 border-stone-200'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="flex-1 p-2 text-xs bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                          placeholder="Tên nút..."
                          autoFocus
                        />
                        <select
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          className="p-2 text-xs bg-white border border-stone-300 rounded-lg outline-none"
                        >
                          {AVAILABLE_ICONS.map((ic) => (
                            <option key={ic} value={ic}>
                              {ic}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={saveEdit}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-2 text-stone-500 hover:bg-stone-200 rounded-lg text-xs"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Up/Down buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMove(index, 'up')}
                            disabled={index === 0}
                            className={`p-0.5 rounded ${index === 0 ? 'text-stone-300' : 'text-stone-600 hover:bg-stone-200'}`}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMove(index, 'down')}
                            disabled={index === navItems.length - 1}
                            className={`p-0.5 rounded ${
                              index === navItems.length - 1 ? 'text-stone-300' : 'text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="p-2 bg-amber-100 rounded-lg text-amber-900">
                          <DynamicIcon name={item.iconName} className="w-4 h-4" />
                        </div>

                        <div>
                          <div className="font-bold text-xs sm:text-sm text-stone-900">{item.label}</div>
                          <div className="text-[10px] text-stone-400">
                            Loại: {item.targetType} {!item.visible && '• (Đang ẩn)'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleVisible(item.id)}
                          className={`p-1.5 rounded-lg text-xs font-medium border ${
                            item.visible
                              ? 'bg-white text-stone-600 hover:bg-stone-100 border-stone-200'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                          title={item.visible ? 'Ẩn nút' : 'Hiện nút'}
                        >
                          {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => startEdit(item)}
                          className="px-2.5 py-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-medium border border-stone-200 flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-stone-500" />
                          <span>Đổi tên</span>
                        </button>

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Xóa nút"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-100 p-4 border-t border-stone-200 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenFullAdmin();
            }}
            className="text-xs text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 hover:underline"
          >
            <span>Mở Bảng Admin Đầy Đủ</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
