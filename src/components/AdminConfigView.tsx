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
  ChevronDown,
  ChevronUp,
  QrCode,
  Smartphone,
  Copy,
  ExternalLink,
  Share,
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

  // QR Install Panel state (Hiển thị ngay trong Cấu hình Menu Admin)
  const [showQrSection, setShowQrSection] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

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

  const appOrigin =
    typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://bep-pro.onrender.com';

  const iosProfileUrl = `${appOrigin}/api/ios-app.mobileconfig`;
  const androidWebAppUrl = appOrigin;

  // QR Image URLs (Siêu nhẹ, load tức thì bằng SVG/PNG chuẩn)
  const iosQrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    iosProfileUrl
  )}`;
  const androidQrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    androidWebAppUrl
  )}`;

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2000);
  };

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
    if (navItems.length <= 1) return;
    const updated = navItems.filter((i) => i.id !== id);
    onUpdateNavItems(updated);
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
    const defaultNav: NavItem[] = [
      { id: 'nav-checklist', label: 'Checklist Nhân Viên', iconName: 'ListChecks', targetType: 'checklist', visible: true, colorTheme: 'amber' },
      { id: 'nav-history', label: 'Lịch Sử Ca', iconName: 'Archive', targetType: 'history', visible: true, colorTheme: 'emerald' },
      { id: 'nav-analytics', label: 'Thống Kê Ca', iconName: 'BarChart3', targetType: 'analytics', visible: true, colorTheme: 'blue' },
      { id: 'nav-chef-tasks', label: 'Giao Việc Bếp Trưởng', iconName: 'ChefHat', targetType: 'chef_tasks', visible: true, colorTheme: 'amber' },
      { id: 'nav-staff', label: 'Quản Lý Nhân Sự', iconName: 'UserCheck', targetType: 'staff', visible: true, colorTheme: 'purple' },
      { id: 'nav-admin', label: 'Cấu Hình Admin', iconName: 'Sliders', targetType: 'admin', visible: true, colorTheme: 'amber' },
    ];
    onUpdateNavItems(defaultNav);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner - Admin Hệ Thống */}
      <div className="bg-zinc-950 text-white rounded-2xl p-4 sm:p-6 shadow-sm border border-zinc-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 text-white shrink-0">
              <Sliders className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                Quản Trị Hệ Thống (Admin)
              </span>
              <h2 className="text-lg sm:text-2xl font-bold text-white mt-1">
                Cấu Hình Menu & Tải App QR
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Quét mã QR cài đặt nhanh ứng dụng cho nhân viên bếp (iOS & Android) và tùy chỉnh thanh công cụ.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowQrSection(!showQrSection)}
            className="h-9 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span>{showQrSection ? 'Thu gọn Mã QR' : 'Mở Mã QR Tải App'}</span>
          </button>
        </div>
      </div>

      {/* Khu vực Tải App Nhanh bằng Mã QR cho iOS & Android kèm Hướng dẫn chi tiết */}
      {showQrSection && (
        <div className="bg-white rounded-2xl shadow-xs border border-zinc-200 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-950">
                  Mã QR Tải & Cài Đặt App Nhanh (iOS & Android)
                </h3>
                <p className="text-xs text-zinc-500">
                  Đưa camera điện thoại của nhân viên quét trực tiếp mã QR bên dưới để cài App vào màn hình chính.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCopy(androidWebAppUrl, 'web')}
                className="h-8 px-3 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center gap-1.5 transition"
              >
                {copiedLink === 'web' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Đã chép link</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link App</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2 Cột QR: iPhone (iOS) & Android */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cột 1: iOS (iPhone / iPad) */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 flex flex-col justify-between space-y-3.5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>iPhone / iPad (iOS)</span>
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Miễn phí 100%
                    </span>
                  </div>
                </div>

                {/* Khung QR + Hướng dẫn từng bước cho iPhone */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5 bg-white p-3.5 rounded-xl border border-zinc-200/80">
                  <div className="p-2 bg-white rounded-xl border border-zinc-200 shrink-0 shadow-2xs">
                    <img
                      src={iosQrImg}
                      alt="Mã QR cài App cho iPhone iOS"
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain"
                      loading="lazy"
                    />
                    <div className="text-[10px] font-bold text-center text-zinc-500 mt-1">
                      Quét bằng Camera iPhone
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-700 flex-1">
                    <div className="font-bold text-zinc-950 text-xs">
                      Cách 1: Quét QR cài cấu hình tự động
                    </div>
                    <ol className="space-y-1.5 text-[11px] leading-relaxed text-zinc-600 list-decimal list-inside">
                      <li>
                        Mở <strong>Camera iPhone</strong> quét mã QR bên cạnh → Bấm <strong>Cho phép</strong> tải về hồ sơ.
                      </li>
                      <li>
                        Mở <strong>Cài đặt (Settings)</strong> của iPhone → Bấm mục <strong>Đã tải về hồ sơ</strong> ở ngay đầu trang.
                      </li>
                      <li>
                        Bấm <strong>Cài đặt (Install)</strong> ở góc trên phải → App <strong>Bếp Pro</strong> xuất hiện ngay trên màn hình chính!
                      </li>
                    </ol>

                    <div className="pt-1.5 border-t border-zinc-100">
                      <div className="font-bold text-zinc-900 text-[11px] flex items-center gap-1">
                        <Share className="w-3 h-3 text-blue-600" />
                        <span>Cách 2: Thêm nhanh từ trình duyệt Safari</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Mở trang này bằng <strong>Safari</strong> → Bấm nút <strong>Chia sẻ</strong> ở dưới cùng → Chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/ios-app.mobileconfig"
                  className="flex-1 h-9 px-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Tải trực tiếp cấu hình iOS</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(iosProfileUrl, 'ios')}
                  className="h-9 px-3 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink === 'ios' ? 'Đã chép' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Cột 2: Android (Samsung, Oppo, Xiaomi, Vivo...) */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 flex flex-col justify-between space-y-3.5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Điện Thoại Android</span>
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-600 bg-white px-2 py-0.5 rounded-md border border-zinc-200">
                      Samsung • Xiaomi • Oppo
                    </span>
                  </div>
                </div>

                {/* Khung QR + Hướng dẫn từng bước cho Android */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5 bg-white p-3.5 rounded-xl border border-zinc-200/80">
                  <div className="p-2 bg-white rounded-xl border border-zinc-200 shrink-0 shadow-2xs">
                    <img
                      src={androidQrImg}
                      alt="Mã QR cài App cho Android"
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain"
                      loading="lazy"
                    />
                    <div className="text-[10px] font-bold text-center text-zinc-500 mt-1">
                      Quét bằng Camera / Zalo
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-700 flex-1">
                    <div className="font-bold text-zinc-950 text-xs">
                      Hướng dẫn cài App Android trong 10 giây:
                    </div>
                    <ol className="space-y-1.5 text-[11px] leading-relaxed text-zinc-600 list-decimal list-inside">
                      <li>
                        Dùng <strong>Camera</strong> hoặc <strong>Zalo</strong> quét mã QR bên cạnh và chọn mở bằng trình duyệt <strong>Chrome</strong>.
                      </li>
                      <li>
                        Bấm vào biểu tượng <strong>Menu 3 chấm (⋮)</strong> ở góc trên cùng bên phải trình duyệt Chrome.
                      </li>
                      <li>
                        Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo; (Install App)</strong> hoặc <strong>&ldquo;Thêm vào màn hình chính&rdquo;</strong> → Bấm <strong>Cài đặt</strong> là xong!
                      </li>
                    </ol>

                    <div className="pt-1.5 border-t border-zinc-100 text-[11px] text-emerald-700 font-medium">
                      ✓ Tự động lưu đăng nhập & nhận thông báo giao việc mới.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={androidWebAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-9 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở Link Cài Đặt Android</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(androidWebAppUrl, 'android')}
                  className="h-9 px-3 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink === 'android' ? 'Đã chép' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Card: Tùy biến thanh công cụ */}
      <div className="bg-white rounded-2xl shadow-xs border border-zinc-200 p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3.5 border-b border-zinc-100 gap-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Menu className="w-4 h-4 text-zinc-700" />
              Quản Lý Từng Nút Trên Thanh Công Cụ (Menu)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Thêm bớt, đổi tên, thay đổi biểu tượng icon và sắp xếp thứ tự các nút trên thanh menu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetNavItems}
              className="h-8 px-3 text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl border border-zinc-200 font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục mặc định</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddingNav(true)}
              className="h-8 px-3.5 bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Nút Menu</span>
            </button>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="bg-zinc-950 text-white p-3.5 sm:p-4 rounded-xl border border-zinc-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" /> Xem trước thanh menu trực tiếp:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <div
                  key={item.id}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-white flex items-center gap-1.5 border border-zinc-700"
                >
                  <DynamicIcon name={item.iconName} className="w-3.5 h-3.5 text-zinc-300" />
                  <span>{item.label}</span>
                </div>
              ))}
          </div>
        </div>

        {/* List of Current Toolbar Items (Collapsible Dropdown) */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/40">
          <button
            type="button"
            onClick={() => setIsNavListExpanded(!isNavListExpanded)}
            className="w-full px-4 py-3 bg-zinc-100/80 hover:bg-zinc-200/60 transition flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                Danh sách các nút trên menu ({navItems.length} nút)
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 bg-white px-2.5 py-1 rounded-lg border border-zinc-200 shrink-0">
              <span>{isNavListExpanded ? 'Thu gọn' : 'Mở danh sách'}</span>
              {isNavListExpanded ? (
                <ChevronUp className="w-4 h-4 text-zinc-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-600" />
              )}
            </div>
          </button>

          {isNavListExpanded && (
            <div className="divide-y divide-zinc-100 border-t border-zinc-200">
              {navItems.map((item, index) => {
                const isEditing = editingNavId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 transition ${
                      item.visible ? 'bg-white' : 'bg-zinc-100/60 opacity-60'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-900 uppercase">Chỉnh sửa nút:</span>
                          <button
                            type="button"
                            onClick={() => setEditingNavId(null)}
                            className="text-zinc-400 hover:text-zinc-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Tên hiển thị trên menu
                            </label>
                            <input
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="w-full p-2 text-sm bg-white border border-zinc-300 rounded-xl outline-none"
                              placeholder="Nhập tên mới..."
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Biểu tượng (Icon)
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-zinc-100 rounded-lg border border-zinc-300">
                                <DynamicIcon name={editIcon} className="w-5 h-5 text-zinc-800" />
                              </div>
                              <select
                                value={editIcon}
                                onChange={(e) => setEditIcon(e.target.value)}
                                className="w-full p-2 text-xs bg-white border border-zinc-300 rounded-xl outline-none"
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Chức năng liên kết khi bấm
                            </label>
                            <select
                              value={editType}
                              onChange={(e) => setEditType(e.target.value as NavItemType)}
                              className="w-full p-2 text-xs bg-white border border-zinc-300 rounded-xl outline-none"
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
                              <label className="block text-xs font-bold text-zinc-700 mb-1">
                                Tiêu đề trang chi tiết
                              </label>
                              <input
                                type="text"
                                value={editCustomTitle}
                                onChange={(e) => setEditCustomTitle(e.target.value)}
                                className="w-full p-2 text-xs bg-white border border-zinc-300 rounded-xl outline-none"
                                placeholder="Tiêu đề trang..."
                              />
                            </div>
                          )}
                        </div>

                        {editType === 'custom' && (
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Nội dung hướng dẫn / quy trình chi tiết
                            </label>
                            <textarea
                              rows={3}
                              value={editCustomContent}
                              onChange={(e) => setEditCustomContent(e.target.value)}
                              className="w-full p-2 text-xs bg-white border border-zinc-300 rounded-xl outline-none"
                              placeholder="Ghi chú quy trình thực hiện..."
                            />
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingNavId(null)}
                            className="h-8 px-3 text-xs text-zinc-600 hover:bg-zinc-200 rounded-lg"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={saveEditNav}
                            className="h-8 px-4 text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Lưu thay đổi</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveNav(index, 'up')}
                              disabled={index === 0}
                              className={`p-1 rounded hover:bg-zinc-200 ${
                                index === 0 ? 'text-zinc-300 cursor-not-allowed' : 'text-zinc-600'
                              }`}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveNav(index, 'down')}
                              disabled={index === navItems.length - 1}
                              className={`p-1 rounded hover:bg-zinc-200 ${
                                index === navItems.length - 1
                                  ? 'text-zinc-300 cursor-not-allowed'
                                  : 'text-zinc-600'
                              }`}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="p-2 bg-zinc-100 text-zinc-900 rounded-xl border border-zinc-200">
                            <DynamicIcon name={item.iconName} className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-zinc-900">{item.label}</span>
                              {!item.visible && (
                                <span className="text-[10px] font-semibold bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">
                                  Đang ẩn
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Loại: {item.targetType} • Icon: {item.iconName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleToggleNavVisibility(item.id)}
                            className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition border bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                          >
                            {item.visible ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-zinc-500" />
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
                            type="button"
                            onClick={() => startEditNav(item)}
                            className="h-8 px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-1 border border-zinc-200 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteNav(item.id)}
                            className="w-8 h-8 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-xl flex items-center justify-center transition"
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
          <div className="mt-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-900 uppercase flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Thêm Nút Mới Vào Thanh Công Cụ
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingNav(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewNavItem} className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Tên Nút Hiển Thị <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Kiểm Kê Kho, Sổ Tay Bếp..."
                    value={newNavLabel}
                    onChange={(e) => setNewNavLabel(e.target.value)}
                    className="w-full p-2.5 bg-white border border-zinc-300 rounded-xl text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Chức Năng Khi Bấm Vào Nút
                  </label>
                  <select
                    value={newNavType}
                    onChange={(e) => setNewNavType(e.target.value as NavItemType)}
                    className="w-full p-2.5 bg-white border border-zinc-300 rounded-xl text-sm outline-none"
                  >
                    <option value="custom">Trang Tùy Chỉnh (Nội quy, ghi chú riêng)</option>
                    <option value="checklist">Mở Bảng Checklist Nhân Viên</option>
                    <option value="chef_tasks">Mở Giao Việc Bếp Trưởng</option>
                    <option value="history">Mở Lịch Sử Ca Bếp</option>
                    <option value="analytics">Mở Báo Cáo & Thống Kê</option>
                    <option value="staff">Mở Quản Lý Nhân Sự</option>
                    <option value="admin">Mở Cấu Hình Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Chọn Biểu Tượng (Icon)
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 p-2 bg-white rounded-xl border border-zinc-200 max-h-32 overflow-y-auto">
                  {AVAILABLE_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewNavIcon(ic)}
                      className={`p-2 rounded-lg flex items-center justify-center transition ${
                        newNavIcon === ic
                          ? 'bg-zinc-950 text-white'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <DynamicIcon name={ic} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {newNavType === 'custom' && (
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-zinc-200">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Tiêu Đề Trang Tùy Chỉnh
                    </label>
                    <input
                      type="text"
                      placeholder="Tiêu đề hiển thị..."
                      value={newNavCustomTitle}
                      onChange={(e) => setNewNavCustomTitle(e.target.value)}
                      className="w-full p-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Nội Dung Chi Tiết / Hướng Dẫn Vận Hành
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Nhập nội dung quy định bếp..."
                      value={newNavCustomContent}
                      onChange={(e) => setNewNavCustomContent(e.target.value)}
                      className="w-full p-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNav(false)}
                  className="h-8 px-3.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Vào Menu</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Card: Tùy biến Tên Nhà Hàng / App Branding */}
      <div className="bg-white rounded-2xl shadow-xs border border-zinc-200 p-4 sm:p-6">
        <h3 className="text-base font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Tùy Chỉnh Thương Hiệu Bếp & Tiêu Đề Header
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          Thay đổi tên nhà hàng và khẩu hiệu hiển thị ở góc trái trên cùng thanh công cụ.
        </p>

        <form onSubmit={handleSaveBranding} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Tên Ứng Dụng / Nhà Hàng
              </label>
              <input
                type="text"
                required
                value={brandingForm.appTitle}
                onChange={(e) =>
                  setBrandingForm({ ...brandingForm, appTitle: e.target.value })
                }
                className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-sm outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Khẩu Hiệu / Mô Tả Phụ
              </label>
              <input
                type="text"
                value={brandingForm.appSubtitle}
                onChange={(e) =>
                  setBrandingForm({ ...brandingForm, appSubtitle: e.target.value })
                }
                className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Logo Biểu Tượng Bếp
              </label>
              <select
                value={brandingForm.brandIcon}
                onChange={(e) =>
                  setBrandingForm({ ...brandingForm, brandIcon: e.target.value })
                }
                className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-sm outline-none"
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

          <div className="flex items-center justify-between pt-1">
            {brandingSaved ? (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Đã cập nhật tên thương hiệu thành công!
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="h-9 px-4 bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu Thương Hiệu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
