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
  ExternalLink,
  QrCode,
  Smartphone,
  Copy,
  Check,
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
  const [activeSubTab, setActiveSubTab] = useState<'qr' | 'menu'>('qr');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('ListChecks');
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('Sparkles');
  const [newType, setNewType] = useState<NavItemType>('custom');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const appOrigin =
    typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://bep-pro.onrender.com';

  const iosProfileUrl = `${appOrigin}/api/ios-app.mobileconfig`;
  const androidWebAppUrl = appOrigin;

  const iosQrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
    iosProfileUrl
  )}`;
  const androidQrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
    androidWebAppUrl
  )}`;

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

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
    if (navItems.length <= 1) return;
    onUpdateNavItems(navItems.filter((item) => item.id !== id));
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 pt-safe-top pb-safe-bottom animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[82dvh]">
        {/* Header */}
        <div className="bg-zinc-950 text-white p-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-800 rounded-xl text-white">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                Cấu Hình Menu & Mã QR Cài App
              </h3>
              <p className="text-[11px] text-zinc-400">
                Quét QR tải nhanh cho iOS / Android và tùy chỉnh thanh công cụ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tab Switcher */}
        <div className="px-4 pt-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('qr')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === 'qr'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Tải App (iOS & Android)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('menu')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === 'menu'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Tùy Biến Các Nút Menu ({navItems.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {activeSubTab === 'qr' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* iOS QR Card */}
              <div className="p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50/70 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>iPhone / iPad (iOS)</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Cài Nhanh
                    </span>
                  </div>

                  <div className="flex flex-col items-center bg-white p-3 rounded-xl border border-zinc-200">
                    <img
                      src={iosQrImg}
                      alt="QR iOS"
                      className="w-32 h-32 object-contain"
                      loading="lazy"
                    />
                    <span className="text-[10px] font-semibold text-zinc-500 mt-1">
                      Quét bằng Camera iPhone
                    </span>
                  </div>

                  <ol className="text-[11px] text-zinc-600 space-y-1 list-decimal list-inside leading-relaxed">
                    <li>
                      Quét mã QR bằng <strong>Camera iPhone</strong> → Bấm <strong>Cho phép</strong> tải về hồ sơ.
                    </li>
                    <li>
                      Vào <strong>Cài đặt (Settings)</strong> → <strong>Đã tải về hồ sơ</strong> → Bấm <strong>Cài đặt</strong>.
                    </li>
                    <li>
                      Hoặc mở bằng <strong>Safari</strong> → Bấm <strong>Chia sẻ</strong> → <strong>Thêm vào MH chính</strong>.
                    </li>
                  </ol>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href="/api/ios-app.mobileconfig"
                    className="flex-1 h-8 px-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Cài Đặt iOS</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(iosProfileUrl, 'ios')}
                    className="h-8 px-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 flex items-center gap-1"
                  >
                    {copied === 'ios' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied === 'ios' ? 'Đã chép' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Android QR Card */}
              <div className="p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50/70 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Điện Thoại Android</span>
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 bg-white px-2 py-0.5 rounded border border-zinc-200">
                      Chrome / Zalo
                    </span>
                  </div>

                  <div className="flex flex-col items-center bg-white p-3 rounded-xl border border-zinc-200">
                    <img
                      src={androidQrImg}
                      alt="QR Android"
                      className="w-32 h-32 object-contain"
                      loading="lazy"
                    />
                    <span className="text-[10px] font-semibold text-zinc-500 mt-1">
                      Quét bằng Camera hoặc Zalo
                    </span>
                  </div>

                  <ol className="text-[11px] text-zinc-600 space-y-1 list-decimal list-inside leading-relaxed">
                    <li>
                      Quét mã QR bằng <strong>Camera / Zalo</strong> và mở bằng trình duyệt <strong>Chrome</strong>.
                    </li>
                    <li>
                      Bấm nút <strong>Menu 3 chấm (⋮)</strong> ở góc trên bên phải Chrome.
                    </li>
                    <li>
                      Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> (hoặc <strong>Thêm vào màn hình chính</strong>).
                    </li>
                  </ol>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={androidWebAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 h-8 px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở Link Android</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(androidWebAppUrl, 'android')}
                    className="h-8 px-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 flex items-center gap-1"
                  >
                    {copied === 'android' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied === 'android' ? 'Đã chép' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Action bar */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Các nút hiện có ({navItems.length}):
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="h-8 px-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Nút Mới</span>
                </button>
              </div>

              {/* Add form */}
              {isAdding && (
                <form onSubmit={handleAddNew} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 uppercase">Thêm Nút Vào Menu:</span>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="text-zinc-400 hover:text-zinc-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">Tên Nút Hiển Thị</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Kiểm Kê Kho, Sổ Giao Ca..."
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-xs outline-none"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">Chức Năng</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as NavItemType)}
                        className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-xs outline-none"
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
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Chọn Icon</label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-zinc-200 max-h-24 overflow-y-auto">
                      {AVAILABLE_ICONS.slice(0, 16).map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewIcon(ic)}
                          className={`p-1.5 rounded flex items-center justify-center transition ${
                            newIcon === ic ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-100 text-zinc-700'
                          }`}
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
                      className="h-8 px-3 text-xs text-zinc-600 hover:bg-zinc-200 rounded-lg"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="h-8 px-3.5 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800"
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
                        item.visible ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-100 opacity-60 border-zinc-200'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="flex-1 p-2 text-xs bg-white border border-zinc-300 rounded-lg outline-none"
                            placeholder="Tên nút..."
                            autoFocus
                          />
                          <select
                            value={editIcon}
                            onChange={(e) => setEditIcon(e.target.value)}
                            className="p-2 text-xs bg-white border border-zinc-300 rounded-lg outline-none"
                          >
                            {AVAILABLE_ICONS.map((ic) => (
                              <option key={ic} value={ic}>
                                {ic}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="h-8 px-2 text-zinc-500 hover:bg-zinc-200 rounded-lg text-xs"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMove(index, 'up')}
                                disabled={index === 0}
                                className={`p-0.5 rounded ${index === 0 ? 'text-zinc-300' : 'text-zinc-600 hover:bg-zinc-200'}`}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMove(index, 'down')}
                                disabled={index === navItems.length - 1}
                                className={`p-0.5 rounded ${
                                  index === navItems.length - 1 ? 'text-zinc-300' : 'text-zinc-600 hover:bg-zinc-200'
                                }`}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-900 shrink-0">
                              <DynamicIcon name={item.iconName} className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="font-bold text-xs sm:text-sm text-zinc-900 truncate">{item.label}</div>
                              <div className="text-[10px] text-zinc-400">
                                Loại: {item.targetType} {!item.visible && '• (Đang ẩn)'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleVisible(item.id)}
                              className="w-8 h-8 rounded-lg text-xs font-medium border bg-white text-zinc-600 hover:bg-zinc-100 border-zinc-200 flex items-center justify-center"
                            >
                              {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="h-8 px-2.5 bg-white hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs font-medium border border-zinc-200 flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3 text-zinc-500" />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="w-8 h-8 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center"
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-zinc-50 p-3.5 border-t border-zinc-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFullAdmin();
            }}
            className="text-xs text-zinc-700 hover:text-zinc-950 font-bold flex items-center gap-1 hover:underline"
          >
            <span>Mở Trang Cấu Hình Admin Đầy Đủ</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
