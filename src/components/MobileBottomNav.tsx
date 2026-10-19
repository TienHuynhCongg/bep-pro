import React, { useState } from 'react';
import { NavItem, StaffUser, canRoleAccessTab } from '../types.ts';
import { DynamicIcon } from './DynamicIcon.tsx';
import { Menu, X, Settings2 } from 'lucide-react';

interface MobileBottomNavProps {
  navItems: NavItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onOpenNavConfig: () => void;
  pendingTasksCount?: number;
  totalLogsCount?: number;
  currentUser?: StaffUser | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  navItems,
  activeTabId,
  onSelectTab,
  onOpenNavConfig,
  pendingTasksCount = 0,
  totalLogsCount = 0,
  currentUser = null,
}) => {
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  // Only show visible items permitted for the current user's role
  const visibleItems = navItems.filter(
    (i) => i.visible && canRoleAccessTab(currentUser?.role, i.targetType, i)
  );

  // Take top 4 items for direct bottom bar, rest go to "Thêm" drawer
  const primaryItems = visibleItems.slice(0, 4);
  const overflowItems = visibleItems.slice(4);

  const isOverflowActive = overflowItems.some((i) => i.id === activeTabId);

  return (
    <>
      {/* Fixed Bottom Navigation Bar for Mobile Phones (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-900/95 backdrop-blur-md border-t border-amber-900/60 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_25px_rgba(0,0,0,0.3)]">
        <div className="grid grid-flow-col auto-cols-fr items-center h-16 px-1">
          {primaryItems.map((item) => {
            const isActive = activeTabId === item.id;

            let badge: React.ReactNode = null;
            if (item.targetType === 'checklist' && pendingTasksCount > 0) {
              badge = (
                <span className="absolute -top-1 -right-1.5 px-1.5 py-0.2 bg-rose-500 text-white font-extrabold text-[9px] rounded-full border border-stone-900">
                  {pendingTasksCount}
                </span>
              );
            } else if (item.targetType === 'history' && totalLogsCount > 0) {
              badge = (
                <span className="absolute -top-1 -right-1.5 px-1.5 py-0.2 bg-emerald-600 text-white font-bold text-[9px] rounded-full border border-stone-900">
                  {totalLogsCount}
                </span>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setShowMoreSheet(false);
                }}
                className={`relative flex flex-col items-center justify-center h-full py-1 transition-all active:scale-95 touch-manipulation ${
                  isActive ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <div className="relative">
                  <DynamicIcon
                    name={item.iconName}
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'scale-110 text-amber-400 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]' : 'text-stone-400'
                    }`}
                  />
                  {badge}
                </div>
                <span
                  className={`text-[10px] mt-1 font-semibold truncate max-w-[68px] leading-tight ${
                    isActive ? 'text-amber-300 font-bold' : 'text-stone-400'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-5 h-1 bg-amber-500 rounded-full shadow-sm" />
                )}
              </button>
            );
          })}

          {/* More Tabs button if more than 4 items */}
          {overflowItems.length > 0 && (
            <button
              onClick={() => setShowMoreSheet(true)}
              className={`relative flex flex-col items-center justify-center h-full py-1 transition-all active:scale-95 touch-manipulation ${
                isOverflowActive || showMoreSheet ? 'text-amber-400' : 'text-stone-400'
              }`}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-semibold leading-tight">Thêm</span>
              {isOverflowActive && (
                <span className="absolute bottom-1 w-5 h-1 bg-amber-500 rounded-full" />
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Drawer / Bottom Sheet for overflow items */}
      {showMoreSheet && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end animate-fadeIn">
          <div
            className="fixed inset-0"
            onClick={() => setShowMoreSheet(false)}
          />

          <div className="relative bg-stone-900 border-t border-amber-800/80 rounded-t-3xl p-5 space-y-4 shadow-2xl z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Menu Chức Năng Bếp
              </span>
              <button
                onClick={() => setShowMoreSheet(false)}
                className="p-1 rounded-full text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto">
              {visibleItems.map((item) => {
                const isActive = activeTabId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      setShowMoreSheet(false);
                    }}
                    className={`p-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition text-left border ${
                      isActive
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-stone-800/80 text-stone-200 border-stone-700 hover:bg-stone-800'
                    }`}
                  >
                    <div className="p-2 bg-stone-900/60 rounded-xl">
                      <DynamicIcon name={item.iconName} className="w-4 h-4 text-amber-300" />
                    </div>
                    <span className="truncate flex-1">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => {
                  setShowMoreSheet(false);
                  onOpenNavConfig();
                }}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-stone-700"
              >
                <Settings2 className="w-4 h-4" />
                <span>Sắp xếp & Tùy biến thanh công cụ</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
