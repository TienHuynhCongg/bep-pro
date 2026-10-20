import React from 'react';
import { AppConfig, NavItem, StaffUser, canRoleAccessTab } from '../types.ts';
import { DynamicIcon } from './DynamicIcon.tsx';
import { Settings2, PlusCircle, Sparkles, User, LogIn, Download } from 'lucide-react';

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
  onOpenInstallApp?: () => void;
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
  onOpenInstallApp,
}) => {
  // Only show visible items permitted for the current user's role
  const visibleItems = navItems.filter(
    (item) => item.visible && canRoleAccessTab(currentUser?.role, item.targetType, item)
  );

  return (
    <header className="bg-gradient-to-r from-amber-950 via-stone-900 to-amber-950 text-white shadow-xl sticky top-0 z-40 border-b border-amber-900/60">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => onSelectTab(visibleItems[0]?.id || 'nav-checklist')}>
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl shadow-lg shadow-amber-950/40 group-hover:scale-105 transition-transform border border-amber-400/30 flex items-center justify-center">
              <DynamicIcon name={config.brandIcon || 'Utensils'} className="w-5 h-5 sm:w-6 sm:h-6 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-xl tracking-tight text-amber-50 group-hover:text-amber-200 transition">
                  {config.appTitle || 'KITCHEN LOG PRO'}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Sparkles className="w-2.5 h-2.5" /> Bếp Chuẩn
                </span>
              </div>
              <p className="text-xs text-amber-300/80 truncate max-w-[200px] sm:max-w-xs font-normal">
                {config.appSubtitle || 'Quản Lý Công Việc Bếp Núc Hàng Ngày'}
              </p>
            </div>
          </div>

          {/* Dynamic Navigation Toolbar Items */}
          <div className="flex items-center gap-1 sm:gap-2">
            <nav className="hidden md:flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-1 scrollbar-none max-w-[65vw] sm:max-w-none">
              {visibleItems.map((item) => {
                const isActive = activeTabId === item.id;
                
                let badgeContent: React.ReactNode = null;
                if (item.targetType === 'checklist' && pendingTasksCount > 0) {
                  badgeContent = (
                    <span className="ml-1.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                      {pendingTasksCount}
                    </span>
                  );
                } else if (item.targetType === 'history' && totalLogsCount > 0) {
                  badgeContent = (
                    <span className="ml-1.5 px-1.5 py-0.2 text-[10px] font-medium rounded-full bg-emerald-700/80 text-emerald-200">
                      {totalLogsCount}
                    </span>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`relative px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-900/60 ring-1 ring-amber-400/40 scale-[1.02]'
                        : 'text-amber-200 hover:text-white hover:bg-amber-900/50 bg-stone-900/40 border border-amber-900/30'
                    }`}
                    title={item.label}
                  >
                    <DynamicIcon
                      name={item.iconName}
                      className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${
                        isActive ? 'text-amber-100' : 'text-amber-400 group-hover:text-amber-200'
                      }`}
                    />
                    <span className="inline-block">{item.label}</span>
                    {badgeContent}
                  </button>
                );
              })}
            </nav>

            {/* User Login & Profile Button */}
            {currentUser ? (
              <button
                onClick={onOpenLogin}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold bg-stone-900/60 hover:bg-stone-800 text-amber-200 border border-amber-600/40 transition flex items-center gap-2 shrink-0 group shadow-inner"
                title={`Đang đăng nhập: ${currentUser.fullName} (${currentUser.role}) - Bấm để chuyển tài khoản`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-extrabold ${
                    currentUser.avatarColor || 'bg-amber-600'
                  }`}
                >
                  {currentUser.fullName.slice(0, 1)}
                </div>
                <div className="hidden lg:flex flex-col text-left leading-none">
                  <span className="text-[11px] font-bold text-amber-100 group-hover:text-white max-w-[100px] truncate">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono font-bold mt-0.5">
                    @{currentUser.role}
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center gap-1.5 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng Nhập</span>
              </button>
            )}

            {/* Quick Button to customize Toolbar in Admin (Admin Only) */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={onOpenNavConfig}
                className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-medium bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 hover:text-amber-100 border border-amber-700/50 transition flex items-center gap-1.5 shrink-0"
                title="Tùy biến thanh công cụ (Thêm bớt, đổi tên, thay icon)"
              >
                <Settings2 className="w-4 h-4 text-amber-400" />
                <span className="hidden xl:inline">Sửa Menu</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
