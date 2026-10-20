import React, { useState, useEffect } from 'react';
import { InventoryCheckItem, StaffUser } from '../types.ts';
import {
  PackageCheck,
  Plus,
  Trash2,
  Search,
  Download,
  Save,
  Calendar,
  Copy,
  Lock,
  Check,
} from 'lucide-react';

interface InventoryCheckViewProps {
  items: InventoryCheckItem[];
  onSaveItem: (item: InventoryCheckItem, isEdit: boolean) => void;
  onDeleteItem: (id: string) => void;
  onSaveDailyTable?: (dateStr: string, updatedAllItems: InventoryCheckItem[]) => void;
  onDeleteDateTable?: (dateStr: string) => void;
  currentUser?: StaffUser | null;
}

const COMMON_UNITS = ['kg', 'g', 'ml', 'lít', 'phần', 'hộp', 'bịch', 'cái', 'khay', 'chai'];

// Chỉ cho phép nhập số và dấu thập phân
function sanitizeNumericInput(raw: string): string {
  const normalized = raw.replace(/,/g, '.');
  let result = '';
  let hasDot = false;
  for (const ch of normalized) {
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !hasDot) {
      result += '.';
      hasDot = true;
    }
  }
  return result;
}

export const InventoryCheckView: React.FC<InventoryCheckViewProps> = ({
  items,
  onSaveItem,
  onDeleteItem,
  onSaveDailyTable,
  onDeleteDateTable,
  currentUser = null,
}) => {
  const todayStr = new Date().toLocaleDateString('vi-VN');
  const isAdmin = currentUser?.role === 'admin';

  // Danh sách các ngày đã có bảng lưu (luôn có ngày hôm nay ở đầu)
  const existingDates = Array.from(
    new Set([todayStr, ...items.map((i) => i.dateStr).filter(Boolean)])
  );

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [customDateInput, setCustomDateInput] = useState<string>('');
  const [showNewDateBox, setShowNewDateBox] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteTableDate, setConfirmDeleteTableDate] = useState<boolean>(false);
  const [justSavedBanner, setJustSavedBanner] = useState<boolean>(false);

  // Bản nháp cục bộ để gõ mượt trực tiếp trong bảng không bị giật
  const [localItems, setLocalItems] = useState<InventoryCheckItem[]>(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Các dòng thuộc bảng của ngày đang chọn
  const rowsForSelectedDate = localItems.filter((i) => i.dateStr === selectedDate);

  const filteredRows = rowsForSelectedDate.filter((row) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      row.itemName.toLowerCase().includes(q) ||
      row.dateStr.toLowerCase().includes(q) ||
      (row.unit || '').toLowerCase().includes(q)
    );
  });

  // Thay đổi trực tiếp 1 ô trong bảng (tự động cập nhật state)
  const handleCellChange = (
    id: string,
    field: 'dateStr' | 'itemName' | 'stockQty' | 'wasteQty' | 'unit',
    rawValue: string
  ) => {
    const value =
      field === 'stockQty' || field === 'wasteQty'
        ? sanitizeNumericInput(rawValue)
        : rawValue;

    setLocalItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const nextStock = field === 'stockQty' ? value : row.stockQty;
        const nextWaste = field === 'wasteQty' ? value : row.wasteQty;
        const hasStock = Number(nextStock) > 0;
        const hasWaste = Number(nextWaste) > 0;
        const nextStatus: 'ton' | 'huy' | 'both' =
          hasStock && hasWaste ? 'both' : hasWaste ? 'huy' : 'ton';

        return {
          ...row,
          [field]: value,
          statusType: nextStatus,
          createdBy: currentUser?.fullName || row.createdBy || 'Nhân viên ca',
          createdAt: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      })
    );
  };

  // Khi rời ô input (onBlur), tự động lưu dòng đó lên Server
  const handleCellBlur = (id: string) => {
    const updatedRow = localItems.find((r) => r.id === id);
    if (!updatedRow) return;
    onSaveItem(updatedRow, true);
  };

  // Thêm 1 dòng mới trực tiếp vào bảng của ngày đang chọn
  const handleAddRowInline = () => {
    const newRow: InventoryCheckItem = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      dateStr: selectedDate,
      itemName: '',
      stockQty: '0',
      wasteQty: '0',
      unit: 'kg',
      statusType: 'ton',
      createdBy: currentUser?.fullName || 'Nhân viên ca',
      createdAt: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    const next = [...localItems, newRow];
    setLocalItems(next);
    onSaveItem(newRow, false);
  };

  // Sao chép danh mục tên mặt hàng từ ngày trước sang bảng ngày hiện tại để không phải gõ lại tên
  const handleCopyTemplateFromPreviousDay = () => {
    const otherDates = existingDates.filter((d) => d !== selectedDate);
    const sourceDate = otherDates[0];
    if (!sourceDate) return;

    const sourceRows = localItems.filter((i) => i.dateStr === sourceDate && i.itemName.trim());
    if (sourceRows.length === 0) return;

    const existingNames = new Set(
      rowsForSelectedDate.map((r) => r.itemName.trim().toLowerCase())
    );

    const copiedRows: InventoryCheckItem[] = sourceRows
      .filter((r) => !existingNames.has(r.itemName.trim().toLowerCase()))
      .map((r, idx) => ({
        id: `inv-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        dateStr: selectedDate,
        itemName: r.itemName,
        stockQty: '0',
        wasteQty: '0',
        unit: r.unit || 'kg',
        statusType: 'ton',
        createdBy: currentUser?.fullName || 'Nhân viên ca',
        createdAt: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));

    if (copiedRows.length === 0) return;

    const nextAll = [...localItems, ...copiedRows];
    setLocalItems(nextAll);
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, nextAll);
    } else {
      copiedRows.forEach((row) => onSaveItem(row, false));
    }
  };

  // Lưu toàn bộ bảng theo ngày
  const handleSaveEntireDailyTable = () => {
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, localItems);
    } else {
      rowsForSelectedDate.forEach((row) => onSaveItem(row, true));
    }
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 2500);
  };

  // Tạo hoặc chuyển sang bảng ngày khác
  const handleCreateOrSwitchDate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customDateInput.trim();
    if (!trimmed) return;
    setSelectedDate(trimmed);
    setCustomDateInput('');
    setShowNewDateBox(false);
  };

  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;
    const headers = [
      'Ngày',
      'Tên mặt hàng',
      'Số lượng Tồn',
      'Số lượng Hủy',
      'Định lượng',
      'Người kiểm',
      'Giờ lưu',
    ];
    const rows = filteredRows.map((i) => [
      `"${i.dateStr}"`,
      `"${(i.itemName || '').replace(/"/g, '""')}"`,
      `"${i.stockQty || '0'}"`,
      `"${i.wasteQty || '0'}"`,
      `"${i.unit || ''}"`,
      `"${i.createdBy || ''}"`,
      `"${i.createdAt || ''}"`,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Ton_Kiem_${selectedDate.replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3.5">
      {/* Khung Bảng Lưu Số Lượng Tồn Kiểm Trực Tiếp Theo Ngày */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-3.5 sm:p-5 space-y-3.5">
        {/* Header: Tiêu đề + Nút Lưu Bảng Theo Ngày */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-zinc-950">
                  Bảng Lưu Tồn Kiểm Theo Ngày
                </h2>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Ngày: {selectedDate}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Chạm trực tiếp vào từng ô trong bảng để sửa • Lưu bảng theo ngày • Chỉ Admin (@admin) được quyền xóa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAddRowInline}
              className="h-9 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm dòng</span>
            </button>

            <button
              type="button"
              onClick={handleSaveEntireDailyTable}
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
            >
              {justSavedBanner ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã Lưu Bảng ({selectedDate})</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Bảng Ngày {selectedDate}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Thanh Chọn Bảng Theo Ngày (Tabs Ngày) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-[11px] font-bold text-zinc-500 uppercase px-1.5 flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              <span>Bảng ngày:</span>
            </span>

            {existingDates.map((d) => {
              const count = localItems.filter((i) => i.dateStr === d).length;
              const isSelected = d === selectedDate;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d);
                    setConfirmDeleteTableDate(false);
                  }}
                  className={`h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-zinc-950 text-white shadow-2xs'
                      : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                  }`}
                >
                  <span>{d === todayStr ? `Hôm nay (${d})` : d}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowNewDateBox(!showNewDateBox)}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-white hover:bg-zinc-100 text-zinc-700 border border-dashed border-zinc-300 whitespace-nowrap shrink-0 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Ngày khác</span>
            </button>
          </div>

          {/* Tìm kiếm & Xuất Excel & Xóa Bảng Ngày (Chỉ Admin) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative min-w-[140px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Lọc nhanh tên..."
                className="w-full h-8 pl-8 pr-2.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {filteredRows.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="h-8 px-2.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold flex items-center gap-1 transition shrink-0"
                title="Xuất bảng ngày này ra Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            )}

            {/* Chỉ Admin mới được xóa toàn bộ bảng ngày */}
            {isAdmin && rowsForSelectedDate.length > 0 && onDeleteDateTable && (
              confirmDeleteTableDate ? (
                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteDateTable(selectedDate);
                      setConfirmDeleteTableDate(false);
                    }}
                    className="h-7 px-2 bg-rose-600 text-white rounded text-[11px] font-bold whitespace-nowrap"
                  >
                    Xác nhận xóa bảng {selectedDate}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTableDate(false)}
                    className="h-7 px-1.5 text-zinc-600 text-[11px] font-semibold"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTableDate(true)}
                  className="h-8 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1 transition shrink-0"
                  title="Xóa toàn bộ bảng ngày này (Chỉ Admin)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xóa bảng ngày</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Ô nhập ngày tùy chọn khi bấm "+ Ngày khác" */}
        {showNewDateBox && (
          <form
            onSubmit={handleCreateOrSwitchDate}
            className="flex items-center gap-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200"
          >
            <span className="text-xs font-semibold text-zinc-700">Nhập ngày (DD/MM/YYYY):</span>
            <input
              type="text"
              value={customDateInput}
              onChange={(e) => setCustomDateInput(e.target.value)}
              placeholder="VD: 21/10/2026"
              className="h-8 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="h-8 px-3 bg-zinc-950 text-white rounded-lg text-xs font-bold"
            >
              Mở Bảng Ngày Này
            </button>
            <button
              type="button"
              onClick={() => setShowNewDateBox(false)}
              className="h-8 px-2.5 text-xs text-zinc-500 hover:text-zinc-800"
            >
              Đóng
            </button>
          </form>
        )}

        {/* BẢNG 3 CỘT THAY ĐỔI TRỰC TIẾP: NGÀY | TÊN | SỐ LƯỢNG TỒN / HỦY */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 bg-zinc-950 text-white px-2.5 sm:px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider items-center">
            <div className="col-span-3 sm:col-span-2">Ngày</div>
            <div className="col-span-4 sm:col-span-5">Tên mặt hàng</div>
            <div className="col-span-5 sm:col-span-5 text-right pr-1">
              Số lượng tồn / hủy (Sửa trực tiếp)
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="py-8 px-4 text-center bg-zinc-50 space-y-3">
              <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                Bảng ngày <strong>{selectedDate}</strong> chưa có dòng kiểm hàng nào.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRowInline}
                  className="h-9 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng đầu tiên</span>
                </button>

                {existingDates.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyTemplateFromPreviousDay}
                    className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 text-xs font-bold inline-flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Lấy danh sách tên mặt hàng từ ngày trước</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200/80 bg-white">
              {filteredRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-12 px-2 sm:px-4 py-2 items-center gap-1.5 sm:gap-2.5 hover:bg-zinc-50/70 transition"
                >
                  {/* Cột 1: Ngày (Gõ sửa trực tiếp hoặc giữ mặc định theo bảng ngày) */}
                  <div className="col-span-3 sm:col-span-2">
                    <input
                      type="text"
                      value={row.dateStr}
                      onChange={(e) => handleCellChange(row.id, 'dateStr', e.target.value)}
                      onBlur={() => handleCellBlur(row.id)}
                      className="w-full h-8 px-1.5 sm:px-2 bg-zinc-50 hover:bg-white focus:bg-white border border-transparent hover:border-zinc-200 focus:border-zinc-900 rounded-lg font-mono font-bold text-zinc-800 text-[11px] sm:text-xs outline-none transition"
                      title="Ngày kiểm"
                    />
                  </div>

                  {/* Cột 2: Tên Mặt Hàng (Gõ trực tiếp trong bảng) */}
                  <div className="col-span-4 sm:col-span-5">
                    <input
                      type="text"
                      value={row.itemName}
                      onChange={(e) => handleCellChange(row.id, 'itemName', e.target.value)}
                      onBlur={() => handleCellBlur(row.id)}
                      placeholder={`Nhập tên mặt hàng #${idx + 1}...`}
                      className="w-full h-8 px-2 bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent hover:border-zinc-200 focus:border-zinc-900 rounded-lg font-semibold text-zinc-950 text-xs sm:text-sm outline-none transition"
                    />
                  </div>

                  {/* Cột 3: Số Lượng Tồn / Hủy + Đơn vị + Xóa (Chỉ Admin) */}
                  <div className="col-span-5 sm:col-span-5 flex items-center justify-end gap-1 sm:gap-1.5">
                    {/* Ô Tồn (chỉ nhận số) */}
                    <div className="flex items-center bg-emerald-50/90 border border-emerald-200 rounded-lg px-1.5 h-8 focus-within:ring-2 focus-within:ring-emerald-600">
                      <span className="text-[10px] font-bold text-emerald-700 mr-1 hidden sm:inline">
                        Tồn:
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 mr-0.5 sm:hidden">
                        T:
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.stockQty}
                        onChange={(e) => handleCellChange(row.id, 'stockQty', e.target.value)}
                        onBlur={() => handleCellBlur(row.id)}
                        placeholder="0"
                        className="w-10 sm:w-14 bg-transparent font-mono font-bold text-emerald-900 text-xs text-right outline-none"
                        title="Số lượng Tồn (chỉ nhập số)"
                      />
                    </div>

                    {/* Ô Hủy (chỉ nhận số) */}
                    <div className="flex items-center bg-rose-50/90 border border-rose-200 rounded-lg px-1.5 h-8 focus-within:ring-2 focus-within:ring-rose-600">
                      <span className="text-[10px] font-bold text-rose-700 mr-1 hidden sm:inline">
                        Hủy:
                      </span>
                      <span className="text-[10px] font-bold text-rose-700 mr-0.5 sm:hidden">
                        H:
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.wasteQty}
                        onChange={(e) => handleCellChange(row.id, 'wasteQty', e.target.value)}
                        onBlur={() => handleCellBlur(row.id)}
                        placeholder="0"
                        className="w-10 sm:w-14 bg-transparent font-mono font-bold text-rose-900 text-xs text-right outline-none"
                        title="Số lượng Hủy (chỉ nhập số)"
                      />
                    </div>

                    {/* Ô Đơn vị (kg, g, ml...) */}
                    <input
                      type="text"
                      list="inventory-inline-units"
                      value={row.unit}
                      onChange={(e) => handleCellChange(row.id, 'unit', e.target.value)}
                      onBlur={() => handleCellBlur(row.id)}
                      placeholder="đv"
                      className="w-11 sm:w-14 h-8 px-1.5 bg-zinc-100 hover:bg-white focus:bg-white border border-zinc-200 focus:border-zinc-900 rounded-lg text-[11px] font-semibold text-zinc-700 text-center outline-none"
                      title="Định lượng (kg, g, ml, phần...)"
                    />

                    {/* Nút Xóa dòng: CHỈ HIỆN & CHO PHÉP VỚI ADMIN (@admin) */}
                    {isAdmin ? (
                      confirmDeleteId === row.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteItem(row.id);
                            setConfirmDeleteId(null);
                          }}
                          className="h-7 px-2 rounded-lg bg-rose-600 text-white text-[10px] font-bold whitespace-nowrap shrink-0"
                        >
                          Xóa
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(row.id)}
                          className="w-7 h-7 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shrink-0"
                          title="Xóa dòng này (Quyền Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    ) : (
                      <span
                        className="w-6 h-7 flex items-center justify-center text-zinc-300 shrink-0"
                        title="Chỉ Admin mới có quyền xóa dòng kiểm hàng"
                      >
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chân bảng: Nút thêm nhanh dòng mới + Sao chép danh mục ngày cũ + Lưu bảng ngày */}
          <div className="bg-zinc-50 border-t border-zinc-200/80 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddRowInline}
                className="h-8 px-3 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm dòng vào bảng</span>
              </button>

              {existingDates.length > 1 && (
                <button
                  type="button"
                  onClick={handleCopyTemplateFromPreviousDay}
                  className="h-8 px-3 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép tên mặt hàng từ ngày trước</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 hidden sm:inline">
                Tự động lưu khi sửa ô • Chỉ <strong>@admin</strong> được xóa
              </span>
              <button
                type="button"
                onClick={handleSaveEntireDailyTable}
                className="h-8 px-3.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Bảng Ngày {selectedDate}</span>
              </button>
            </div>
          </div>
        </div>

        <datalist id="inventory-inline-units">
          {COMMON_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
    </div>
  );
};
