import React, { useState, useRef, useEffect } from 'react';
import { AppConfig, NavItem, StaffUser, AppNotificationItem, canRoleAccessTab } from '../types.ts';
import { DynamicIcon } from './DynamicIcon.tsx';
import { NotificationFeedBox } from './NotificationFeedBox.tsx';
import { Settings2, LogIn, Bell, ShoppingCart } from 'lucide-react';

interface HeaderNavProps {
  config: AppConfig;
  navItems: NavItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onOpenNavConfig: () => void;
  pendingTasksCount?: number;
  totalLogsCount?: number;
  currentUser?: StaffUser | null;
  onOpenLogin?: () => void;
  notifications?: AppNotificationItem[];
  onDeleteNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
  serverConnected?: boolean;
  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
  onOpenOrderList?: () => void;
  lowStockOrdersCount?: number;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  config,
  navItems,
  activeTabId,
  onSelectTab,
  onOpenNavConfig,
  pendingTasksCount = 0,
  totalLogsCount = 0,
  currentUser = null,
  onOpenLogin,
  notifications = [],
  onDeleteNotification,
  onClearAllNotifications,
  serverConnected = false,
  syncStatus = 'synced',
  onOpenOrderList,
  lowStockOrdersCount = 0,
}) => {
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleItems = navItems.filter(
    (item) => item.visible && canRoleAccessTab(currentUser?.role, item.targetType, item)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    if (showNotifDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifDropdown]);

  return (
    <header className="shrink-0 bg-zinc-950 text-white z-40 border-b border-zinc-800 pt-safe-top select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 sm:h-15 gap-2">
          {/* Brand Logo & Title */}
          <div
            className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
            onClick={() => onSelectTab(visibleItems[0]?.id || 'nav-checklist')}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center shrink-0">
              <DynamicIcon name={config.brandIcon || 'Utensils'} className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white truncate">
                  {config.appTitle || 'KITCHEN LOG PRO'}
                </h1>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                  title={
                    syncStatus === 'synced'
                      ? 'Đã đồng bộ an toàn lên Server'
                      : syncStatus === 'syncing'
                      ? 'Đang lưu lên máy chủ...'
                      : 'Chưa có mạng (Đã lưu tạm trên máy, sẽ tự động đẩy lên khi có mạng)'
                  }
                />
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {syncStatus === 'synced' && <span className="text-emerald-400 font-semibold">Đã lưu Cloud</span>}
                  {syncStatus === 'syncing' && <span className="text-amber-400 font-semibold">Đang lưu...</span>}
                  {(syncStatus === 'offline' || syncStatus === 'error') && (
                    <span className="text-rose-400 font-semibold">Lưu trên máy</span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
                {config.appSubtitle || 'Hệ thống vận hành bếp'}
              </p>
            </div>
          </div>

          {/* Desktop Navigation & Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
              {visibleItems.map((item) => {
                const isActive = activeTabId === item.id;

                let badgeContent: React.ReactNode = null;
                if (item.targetType === 'checklist' && pendingTasksCount > 0) {
                  badgeContent = (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-600 text-white">
                      {pendingTasksCount}
                    </span>
                  );
                } else if (item.targetType === 'history' && totalLogsCount > 0) {
                  badgeContent = (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] font-medium rounded-full bg-zinc-800 text-zinc-300">
                      {totalLogsCount}
                    </span>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <DynamicIcon
                      name={item.iconName}
                      className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`}
                    />
                    <span>{item.label}</span>
                    {badgeContent}
                  </button>
                );
              })}
            </nav>

            {/* Nút Đặt Hàng dành cho tất cả các role */}
            {onOpenOrderList && (
              <button
                type="button"
                onClick={onOpenOrderList}
                className="relative h-9 px-2.5 sm:px-3 rounded-xl border border-amber-600/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold text-xs transition flex items-center gap-1.5 touch-manipulation active:scale-95 shrink-0"
                title="Mở danh sách đặt hàng"
              >
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Đặt Hàng</span>
                {lowStockOrdersCount > 0 && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                    {lowStockOrdersCount > 99 ? '99+' : lowStockOrdersCount}
                  </span>
                )}
              </button>
            )}

            {/* Facebook-style Notification Bell Button & Popover */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowNotifDropdown((prev) => !prev)}
                className={`relative w-9 h-9 rounded-xl border transition flex items-center justify-center touch-manipulation active:scale-95 ${
                  showNotifDropdown
                    ? 'bg-zinc-800 text-white border-zinc-700'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
                }`}
                title="Thông báo hoạt động ca bếp"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-zinc-950">
                    {notifications.length > 99 ? '99+' : notifications.length}
                  </span>
                )}
              </button>

              {showNotifDropdown && onDeleteNotification && onClearAllNotifications && (
                <div className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-[calc(max(env(safe-area-inset-top,0px),48px)+3.5rem)] sm:top-full sm:mt-2 sm:w-96 z-50">
                  <NotificationFeedBox
                    notifications={notifications}
                    onDeleteNotification={onDeleteNotification}
                    onClearAllNotifications={onClearAllNotifications}
                    variant="dropdown"
                    onCloseDropdown={() => setShowNotifDropdown(false)}
                  />
                </div>
              )}
            </div>

            {/* User Profile Pill */}
            {currentUser ? (
              <button
                type="button"
                onClick={onOpenLogin}
                className="h-9 px-2.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 transition flex items-center gap-2 shrink-0 touch-manipulation active:scale-95"
                title={`Đang đăng nhập: ${currentUser.fullName} (@${currentUser.role})`}
              >
                <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white text-[11px] font-bold">
                  {currentUser.fullName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none">
                  <span className="text-[11px] font-semibold text-white max-w-[110px] truncate">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    @{currentUser.role}
                  </span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="h-9 px-3 rounded-xl text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition flex items-center gap-1.5 shrink-0 touch-manipulation active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
            )}

            {/* Admin Quick Menu Customize */}
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={onOpenNavConfig}
                className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition hidden sm:flex items-center justify-center"
                title="Sửa thanh menu"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
