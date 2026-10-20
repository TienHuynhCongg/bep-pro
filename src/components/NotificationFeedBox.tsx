import React, { useState, useEffect } from 'react';
import { AppNotificationItem } from '../types.ts';
import { Bell, Trash2, X, CheckCircle2, Flame, ClipboardList, RotateCcw } from 'lucide-react';

interface NotificationFeedBoxProps {
  notifications: AppNotificationItem[];
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  variant?: 'inline' | 'dropdown';
  onCloseDropdown?: () => void;
}

export function formatRelativeMinutesAgo(createdAtMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  if (diffSec < 45) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}p trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    const remMin = diffMin % 60;
    return remMin > 0 ? `${diffHour}h ${remMin}p trước` : `${diffHour}h trước`;
  }
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

export const NotificationFeedBox: React.FC<NotificationFeedBoxProps> = ({
  notifications,
  onDeleteNotification,
  onClearAllNotifications,
  variant = 'inline',
  onCloseDropdown,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Tự động cập nhật số phút đã trôi qua ("1p trước", "2p trước"...) mỗi 15 giây
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (variant === 'inline' && notifications.length === 0) {
    return null;
  }

  const getBadgeStyle = (type: AppNotificationItem['type']) => {
    switch (type) {
      case 'urgent_assigned':
        return {
          bg: 'bg-rose-600 text-white',
          ring: 'border-l-4 border-l-rose-500 bg-rose-50/40 hover:bg-rose-50/80',
          icon: <Flame className="w-3 h-3 text-white" />,
          dot: 'bg-rose-500',
        };
      case 'task_completed':
        return {
          bg: 'bg-emerald-600 text-white',
          ring: 'border-l-4 border-l-emerald-500 bg-white hover:bg-zinc-50',
          icon: <CheckCircle2 className="w-3 h-3 text-white" />,
          dot: 'bg-emerald-500',
        };
      case 'task_reset':
        return {
          bg: 'bg-amber-600 text-white',
          ring: 'border-l-4 border-l-amber-500 bg-white hover:bg-zinc-50',
          icon: <RotateCcw className="w-3 h-3 text-white" />,
          dot: 'bg-amber-500',
        };
      default:
        return {
          bg: 'bg-blue-600 text-white',
          ring: 'border-l-4 border-l-blue-500 bg-blue-50/20 hover:bg-blue-50/50',
          icon: <ClipboardList className="w-3 h-3 text-white" />,
          dot: 'bg-blue-600',
        };
    }
  };

  return (
    <div
      className={
        variant === 'dropdown'
          ? 'w-full bg-white rounded-2xl shadow-2xl border border-zinc-200/90 overflow-hidden'
          : 'bg-white rounded-2xl shadow-xs border border-zinc-200/90 overflow-hidden mb-4'
      }
    >
      {/* Header giống Facebook Notification */}
      <div className="px-4 py-3 bg-zinc-50/80 border-b border-zinc-200/80 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => variant === 'inline' && setIsCollapsed(!isCollapsed)}
        >
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 text-white">
            <Bell className="w-3.5 h-3.5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-zinc-900">
                Thông báo hoạt động ca
              </span>
              <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">
                • Nhấp vào thông báo bất kỳ để xóa
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 sm:hidden">
              Chạm vào thông báo để xóa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearAllNotifications();
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-600 hover:text-rose-600 hover:bg-rose-50 transition flex items-center gap-1"
              title="Xóa toàn bộ thông báo"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa hết</span>
            </button>
          )}

          {variant === 'inline' && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-zinc-500 hover:bg-zinc-200/60 transition"
            >
              {isCollapsed ? `Mở (${notifications.length})` : 'Thu gọn'}
            </button>
          )}

          {variant === 'dropdown' && onCloseDropdown && (
            <button
              type="button"
              onClick={onCloseDropdown}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Danh sách thông báo kiểu Facebook */}
      {!isCollapsed && (
        <div className="divide-y divide-zinc-100 max-h-[260px] overflow-y-auto overscroll-contain">
          {notifications.length === 0 ? (
            <div className="py-8 px-4 text-center text-zinc-400 text-xs">
              Chưa có thông báo mới trong ca làm việc này.
            </div>
          ) : (
            notifications.map((item) => {
              const badge = getBadgeStyle(item.type);
              const relativeTime = formatRelativeMinutesAgo(item.createdAtMs, nowMs);
              const initials = (item.actorName || 'BP')
                .split(' ')
                .slice(-2)
                .map((w) => w[0])
                .join('')
                .toUpperCase();

              return (
                <div
                  key={item.id}
                  onClick={() => onDeleteNotification(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onDeleteNotification(item.id);
                    }
                  }}
                  className={`group relative px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-start gap-3 transition-all cursor-pointer select-none active:scale-[0.99] ${badge.ring}`}
                  title="Nhấp vào để xóa thông báo này"
                >
                  {/* Avatar + Sub-badge kiểu Facebook */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {initials}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white ${badge.bg}`}
                    >
                      {badge.icon}
                    </div>
                  </div>

                  {/* Nội dung thông báo + Thời gian trôi qua ("1p trước") */}
                  <div className="flex-1 min-w-0 text-xs sm:text-[13px] leading-snug">
                    <p className="text-zinc-800 break-words">
                      <span className="font-bold text-zinc-950">{item.actorName}</span>{' '}
                      <span className="text-zinc-600">{item.actionText}</span>{' '}
                      {item.targetText && (
                        <span className="font-semibold text-zinc-900">
                          &ldquo;{item.targetText}&rdquo;
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[11px] font-bold ${
                          item.type === 'urgent_assigned'
                            ? 'text-rose-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {relativeTime}
                      </span>
                      <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        • Nhấp để xóa
                      </span>
                    </div>
                  </div>

                  {/* Chấm xanh kiểu FB & nút X nhỏ */}
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    <span className="p-1 rounded-full text-zinc-300 group-hover:text-rose-500 transition">
                      <X className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
