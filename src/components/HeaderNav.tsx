import React, { useState, useRef, useEffect } from 'react';
import { AppConfig, NavItem, StaffUser, AppNotificationItem, canRoleAccessTab } from '../types.ts';
import { DynamicIcon } from './DynamicIcon.tsx';
import { NotificationFeedBox } from './NotificationFeedBox.tsx';
import { Settings2, LogIn, Bell } from 'lucide-react';

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
    <header className="bg-zinc-950 text-white sticky top-0 z-40 border-b border-zinc-800/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Brand Logo & Title (Clean International POS/Linear style) */}
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
            onClick={() => onSelectTab(visibleItems[0]?.id || 'nav-checklist')}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center shrink-0">
              <DynamicIcon name={config.brandIcon || 'Utensils'} className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white truncate">
                  {config.appTitle || 'BẾP PRO'}
                </h1>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    serverConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  title={serverConnected ? 'Đã kết nối đồng bộ trực tiếp' : 'Chế độ ngoại tuyến'}
                />
              </div>
              <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
                {config.appSubtitle || 'Hệ thống vận hành bếp'}
              </p>
            </div>
          </div>

          {/* Desktop Navigation & Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
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
                    onClick={() => onSelectTab(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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

            {/* Facebook-style Notification Bell Button & Popover */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowNotifDropdown((prev) => !prev)}
                className={`relative p-2 rounded-xl border transition flex items-center justify-center ${
                  showNotifDropdown
                    ? 'bg-zinc-800 text-white border-zinc-700'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
                }`}
                title="Thông báo hoạt động ca bếp"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-zinc-950">
                    {notifications.length > 99 ? '99+' : notifications.length}
                  </span>
                )}
              </button>

              {showNotifDropdown && onDeleteNotification && onClearAllNotifications && (
                <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-15 sm:top-full sm:mt-2 sm:w-96 z-50">
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
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 transition flex items-center gap-2 shrink-0"
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
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition flex items-center gap-1.5 shrink-0"
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
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition hidden sm:flex items-center justify-center"
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
