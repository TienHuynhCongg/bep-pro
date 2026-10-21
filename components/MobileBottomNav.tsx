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

  const visibleItems = navItems.filter(
    (i) => i.visible && canRoleAccessTab(currentUser?.role, i.targetType, i)
  );

  const primaryItems = visibleItems.slice(0, 4);
  const overflowItems = visibleItems.slice(4);
  const isOverflowActive = overflowItems.some((i) => i.id === activeTabId);

  return (
    <>
      {/* Fixed Bottom Frame inside App Shell (Không bao giờ đè lên nội dung bên trên) */}
      <nav className="md:hidden shrink-0 z-30 bg-white border-t border-zinc-200 pb-safe-bottom select-none">
        <div className="grid grid-flow-col auto-cols-fr items-center h-14 px-1">
          {primaryItems.map((item) => {
            const isActive = activeTabId === item.id;

            let badge: React.ReactNode = null;
            if (item.targetType === 'checklist' && pendingTasksCount > 0) {
              badge = (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-rose-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white">
                  {pendingTasksCount}
                </span>
              );
            } else if (item.targetType === 'history' && totalLogsCount > 0) {
              badge = (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-zinc-800 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white">
                  {totalLogsCount}
                </span>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setShowMoreSheet(false);
                }}
                className={`relative flex flex-col items-center justify-center h-full py-1 transition-colors active:scale-95 touch-manipulation select-none min-w-0 ${
                  isActive ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <div className="relative">
                  <DynamicIcon
                    name={item.iconName}
                    className={`w-5 h-5 ${isActive ? 'text-zinc-950 stroke-[2.25]' : 'text-zinc-400'}`}
                  />
                  {badge}
                </div>
                <span
                  className={`text-[10px] mt-0.5 truncate max-w-[68px] leading-tight ${
                    isActive ? 'text-zinc-950 font-bold' : 'text-zinc-500 font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {overflowItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowMoreSheet(true)}
              className={`relative flex flex-col items-center justify-center h-full py-1 transition-colors active:scale-95 touch-manipulation select-none min-w-0 ${
                isOverflowActive || showMoreSheet ? 'text-zinc-950' : 'text-zinc-400'
              }`}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-semibold leading-tight">Menu</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Sheet for Overflow Menu */}
      {showMoreSheet && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="fixed inset-0" onClick={() => setShowMoreSheet(false)} />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-4 shadow-2xl z-10 pb-safe-bottom">
            <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Danh mục chức năng
              </span>
              <button
                type="button"
                onClick={() => setShowMoreSheet(false)}
                className="w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-700 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-h-[55vh] overflow-y-auto">
              {visibleItems.map((item) => {
                const isActive = activeTabId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setShowMoreSheet(false);
                    }}
                    className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold transition text-left border ${
                      isActive
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                        : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    <DynamicIcon
                      name={item.iconName}
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-600'}`}
                    />
                    <span className="truncate flex-1">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setShowMoreSheet(false);
                  onOpenNavConfig();
                }}
                className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Settings2 className="w-4 h-4" />
                <span>Tùy chỉnh thanh công cụ</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
