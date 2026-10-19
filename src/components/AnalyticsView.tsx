import React from 'react';
import { ShiftLog } from '../types.ts';
import {
  BarChart3,
  CheckCircle2,
  TrendingUp,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Award,
} from 'lucide-react';

interface AnalyticsViewProps {
  logs: ShiftLog[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ logs }) => {
  const totalLogs = logs.length;

  const totalTasksAssigned = logs.reduce((acc, l) => acc + l.totalCount, 0);
  const totalTasksCompleted = logs.reduce((acc, l) => acc + l.completedCount, 0);
  const avgCompletionRate =
    totalTasksAssigned > 0
      ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100)
      : 0;

  const perfectShiftsCount = logs.filter(
    (l) => l.totalCount > 0 && l.completedCount === l.totalCount
  ).length;

  // Category counts across all logs
  const categoryStats: Record<string, { completed: number; total: number }> = {};

  logs.forEach((log) => {
    log.tasks.forEach((task) => {
      const cat = task.category || 'Khác';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { completed: 0, total: 0 };
      }
      categoryStats[cat].total += 1;
      if (task.completed) {
        categoryStats[cat].completed += 1;
      }
    });
  });

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-500 uppercase">Tổng Ca Đã Báo Cáo</span>
            <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-stone-900">{totalLogs}</div>
          <p className="text-xs text-stone-500 mt-1">Đã lưu trữ trong hệ thống</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-500 uppercase">Tỷ Lệ Hoàn Thành TB</span>
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{avgCompletionRate}%</div>
          <p className="text-xs text-stone-500 mt-1">
            {totalTasksCompleted} / {totalTasksAssigned} đầu việc
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-500 uppercase">Ca Đạt Chuẩn 100%</span>
            <div className="p-2 bg-blue-100 rounded-xl text-blue-800">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{perfectShiftsCount}</div>
          <p className="text-xs text-stone-500 mt-1">
            {totalLogs > 0 ? Math.round((perfectShiftsCount / totalLogs) * 100) : 0}% trên tổng số ca
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-500 uppercase">Tiêu Chuẩn Vệ Sinh</span>
            <div className="p-2 bg-purple-100 rounded-xl text-purple-800">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700">HACCP Pro</div>
          <p className="text-xs text-stone-500 mt-1">Kiểm soát nhiệt độ & an toàn</p>
        </div>
      </div>

      {/* Main Analytics Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance by Category */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            Tỷ Lệ Hoàn Thành Theo Từng Phân Khu Bếp
          </h3>
          <p className="text-xs text-stone-500">
            Đánh giá hiệu suất thực hiện việc tại từng khu vực: Sơ chế, Nấu nướng, Vệ sinh, Kiểm kê.
          </p>

          <div className="space-y-3.5 pt-2">
            {Object.keys(categoryStats).length === 0 ? (
              <p className="text-xs text-stone-400 italic">Chưa có đủ dữ liệu ca để phân tích.</p>
            ) : (
              Object.entries(categoryStats).map(([cat, stats]) => {
                const percent =
                  stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-stone-800">{cat}</span>
                      <span className="font-semibold text-stone-600">
                        {stats.completed}/{stats.total} việc ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Shift Highlights */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Nhật Ký Ca Gần Nhất
          </h3>
          <p className="text-xs text-stone-500">Danh sách các ca bếp được gửi lên gần đây nhất.</p>

          <div className="space-y-2.5 pt-2">
            {logs.slice(0, 5).map((log) => {
              const percent =
                log.totalCount > 0 ? Math.round((log.completedCount / log.totalCount) * 100) : 0;

              return (
                <div
                  key={log.id}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-stone-900">{log.staffName}</div>
                    <div className="text-stone-500 text-[11px]">
                      {log.shiftName} • {log.dateStr}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        percent === 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {percent}% ({log.completedCount}/{log.totalCount})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
