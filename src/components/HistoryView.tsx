import React, { useState } from 'react';
import { ShiftLog, StaffUser, DeleteRequest } from '../types.ts';
import {
  Archive,
  Search,
  FileSpreadsheet,
  Trash2,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Printer,
  ShieldAlert,
  Check,
  X,
  Send,
} from 'lucide-react';

interface HistoryViewProps {
  logs: ShiftLog[];
  onDeleteLog: (id: string) => void;
  onClearAllLogs: () => void;
  onExportCSV: () => void;
  currentUser?: StaffUser | null;
  deleteRequests?: DeleteRequest[];
  onApproveDeleteRequest?: (reqId: string) => void;
  onRejectDeleteRequest?: (reqId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  logs,
  onDeleteLog,
  onClearAllLogs,
  onExportCSV,
  currentUser = null,
  deleteRequests = [],
  onApproveDeleteRequest,
  onRejectDeleteRequest,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';
  const canDeleteOrRequest = isAdmin || isManager;

  const pendingRequests = deleteRequests.filter((r) => r.status === 'pending');

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const matchBasic =
      log.staffName.toLowerCase().includes(q) ||
      log.shiftName.toLowerCase().includes(q) ||
      log.dateStr.toLowerCase().includes(q) ||
      log.id.toLowerCase().includes(q);

    const matchFields = log.fields.some(
      (f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)
    );

    const matchTasks = log.tasks.some((t) => t.title.toLowerCase().includes(q));

    return matchBasic || matchFields || matchTasks;
  });

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Bảng Duyệt Yêu Cầu Xóa (Chỉ hiện cho Admin khi có yêu cầu từ Quản lý) */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-950 font-black text-sm sm:text-base">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Yêu Cầu Xóa Đang Chờ Admin Duyệt ({pendingRequests.length})</span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
              Quyền Admin
            </span>
          </div>

          <div className="divide-y divide-amber-200/70 bg-white rounded-xl border border-amber-200 overflow-hidden">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold text-stone-900">
                    Yêu cầu xóa: <span className="text-rose-600">{req.targetLabel}</span>
                  </div>
                  <div className="text-stone-500">
                    Người gửi: <strong className="text-stone-700">{req.requestedBy}</strong> (Trưởng Ca) • Lúc:{' '}
                    <span className="font-mono">{req.requestedAt}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => onRejectDeleteRequest?.(req.id)}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Không duyệt</span>
                  </button>
                  <button
                    onClick={() => onApproveDeleteRequest?.(req.id)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Duyệt xóa</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thông báo trạng thái yêu cầu xóa của Quản lý */}
      {isManager && pendingRequests.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Đang có <strong>{pendingRequests.length} yêu cầu xóa</strong> chờ Bếp Trưởng (Admin) phê duyệt.
            </span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 sm:p-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 mb-6 border-b border-stone-100 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                Nhật Ký Vận Hành
              </span>
              <span className="text-xs text-stone-500 font-medium">Tổng cộng {logs.length} ca đã lưu</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 flex items-center gap-2">
              <Archive className="w-6 h-6 text-emerald-600" />
              Lịch Sử Báo Cáo Ca Bếp & Lưu Trữ
            </h2>
            <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
              Theo dõi toàn bộ biên bản kiểm tra công việc, nhiệt độ bảo quản và ghi chú phát sinh của từng ca làm việc.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="p-2.5 sm:px-3 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs sm:text-sm font-semibold transition border border-stone-300 flex items-center justify-center gap-1.5"
              title="In báo cáo"
            >
              <Printer className="w-4 h-4 text-stone-600" />
              <span className="hidden sm:inline">In trang</span>
            </button>
            <button
              onClick={onExportCSV}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất File Excel (CSV)</span>
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Tìm theo tên đầu bếp, ca làm, ngày tháng hoặc ghi chú..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {logs.length > 0 && canDeleteOrRequest && (
            <button
              onClick={() => {
                if (isAdmin) {
                  if (window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử ca làm việc?')) {
                    onClearAllLogs();
                  }
                } else {
                  if (window.confirm('Gửi yêu cầu xóa TOÀN BỘ lịch sử ca cho Bếp Trưởng (Admin) phê duyệt?')) {
                    onClearAllLogs();
                  }
                }
              }}
              className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl border border-rose-200 transition shrink-0 flex items-center justify-center gap-1.5"
            >
              {isAdmin ? (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa hết lịch sử</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Yêu cầu xóa hết lịch sử</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* List of Shift Log Cards */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400">
            <Archive className="w-12 h-12 mx-auto text-stone-300 mb-2" />
            <p className="text-base font-bold text-stone-600">Chưa có bản ghi nhật ký ca nào</p>
            <p className="text-xs text-stone-400 mt-1">
              Sau khi nhân viên hoàn thành việc và nhấn &quot;Gửi Báo Cáo Ca&quot;, báo cáo sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const percent =
                log.totalCount > 0 ? Math.round((log.completedCount / log.totalCount) * 100) : 0;
              const isFull = percent === 100;
              const isPendingDelete = pendingRequests.some(
                (r) => r.targetType === 'log_single' && r.targetId === log.id
              );

              return (
                <div
                  key={log.id}
                  className="bg-stone-50/70 border border-stone-200 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 transition shadow-xs"
                >
                  {/* Card Main Row */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-stone-200 text-stone-700">
                          {log.id}
                        </span>
                        <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-stone-500" /> {log.staffName}
                        </span>
                        <span className="text-xs text-stone-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {log.shiftName}
                        </span>
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {log.timestamp}
                        </span>
                        {isPendingDelete && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ⏳ Đang chờ Admin duyệt xóa
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Completion rate badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                            isFull
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isFull ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                          {log.completedCount}/{log.totalCount} việc ({percent}%)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {canDeleteOrRequest && (
                          <button
                            onClick={() => {
                              if (isAdmin) {
                                if (window.confirm(`Xóa báo cáo ${log.id}?`)) {
                                  onDeleteLog(log.id);
                                }
                              } else {
                                if (
                                  window.confirm(
                                    `Gửi yêu cầu xóa báo cáo ${log.id} (${log.staffName}) cho Admin phê duyệt?`
                                  )
                                ) {
                                  onDeleteLog(log.id);
                                }
                              }
                            }}
                            disabled={isPendingDelete && !isAdmin}
                            className={`p-1.5 rounded-lg transition ${
                              isPendingDelete && !isAdmin
                                ? 'text-amber-500 cursor-not-allowed opacity-60'
                                : 'text-stone-400 hover:text-rose-600'
                            }`}
                            title={
                              isAdmin
                                ? 'Xóa báo cáo này'
                                : isPendingDelete
                                ? 'Đang chờ Admin duyệt xóa'
                                : 'Gửi yêu cầu xóa cho Admin duyệt'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Dynamic Fields summary */}
                  <div className="mt-3 pt-3 border-t border-stone-200/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {log.fields.slice(0, 3).map((f, i) => (
                      <div key={i} className="text-xs text-stone-600 bg-white/70 p-2 rounded-lg border border-stone-100">
                        <span className="font-bold text-stone-700">{f.label}:</span>{' '}
                        <span className="text-stone-900">{f.value || '(Trống)'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-stone-200 space-y-4 animate-fadeIn">
                      {/* All Dynamic Fields */}
                      <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                          Toàn bộ thông tin ca đã ghi nhận:
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-stone-200">
                          {log.fields.map((f, i) => (
                            <div key={i} className="text-xs space-y-0.5">
                              <span className="font-bold text-stone-600">{f.label}:</span>
                              <p className="text-stone-900 font-medium whitespace-pre-wrap">{f.value || '(Không ghi)'}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tasks breakdown */}
                      <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                          Chi tiết kiểm tra từng đầu việc trong ca ({log.completedCount}/{log.totalCount}):
                        </h4>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {log.tasks.map((task) => (
                            <div
                              key={task.id}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                task.completed
                                  ? 'bg-emerald-50/70 border-emerald-200 text-stone-800'
                                  : 'bg-rose-50/50 border-rose-200 text-stone-500'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {task.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                )}
                                <span className={task.completed ? 'font-semibold' : 'line-through text-stone-400'}>
                                  {task.title}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-white text-[10px] font-bold text-stone-600 border border-stone-200">
                                {task.category}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

