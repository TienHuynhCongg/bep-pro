import React, { useState } from 'react';
import { InventoryCheckItem, StaffUser } from '../types.ts';
import {
  PackageCheck,
  Plus,
  Trash2,
  Search,
  Download,
  Edit2,
  X,
  Save,
  Calendar,
} from 'lucide-react';

interface InventoryCheckViewProps {
  items: InventoryCheckItem[];
  onSaveItem: (item: InventoryCheckItem, isEdit: boolean) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems?: () => void;
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
  currentUser = null,
}) => {
  const todayDefault = new Date().toLocaleDateString('vi-VN');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState<string>(todayDefault);
  const [itemName, setItemName] = useState<string>('');
  const [statusType, setStatusType] = useState<'ton' | 'huy' | 'both'>('ton');
  const [stockQty, setStockQty] = useState<string>('');
  const [wasteQty, setWasteQty] = useState<string>('');
  const [unit, setUnit] = useState<string>('kg');
  const [formError, setFormError] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setDateStr(new Date().toLocaleDateString('vi-VN'));
    setItemName('');
    setStatusType('ton');
    setStockQty('');
    setWasteQty('');
    setUnit('kg');
    setFormError('');
  };

  const handleStartEdit = (row: InventoryCheckItem) => {
    setEditingId(row.id);
    setDateStr(row.dateStr);
    setItemName(row.itemName);
    setStatusType(row.statusType || 'ton');
    setStockQty(row.stockQty || '');
    setWasteQty(row.wasteQty || '');
    setUnit(row.unit || 'kg');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = itemName.trim();
    const trimmedDate = dateStr.trim() || todayDefault;

    if (!trimmedName) {
      setFormError('Vui lòng nhập Tên nguyên liệu / mặt hàng tồn kiểm!');
      return;
    }

    if (statusType === 'ton' && !stockQty.trim()) {
      setFormError('Vui lòng nhập Số lượng Tồn (số)!');
      return;
    }
    if (statusType === 'huy' && !wasteQty.trim()) {
      setFormError('Vui lòng nhập Số lượng Hủy (số)!');
      return;
    }
    if (statusType === 'both' && !stockQty.trim() && !wasteQty.trim()) {
      setFormError('Vui lòng nhập Số lượng Tồn hoặc Số lượng Hủy!');
      return;
    }

    const payload: InventoryCheckItem = {
      id: editingId || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      dateStr: trimmedDate,
      itemName: trimmedName,
      statusType,
      stockQty: statusType === 'huy' ? '0' : stockQty.trim() || '0',
      wasteQty: statusType === 'ton' ? '0' : wasteQty.trim() || '0',
      unit: unit.trim() || 'kg',
      createdBy: currentUser?.fullName || 'Nhân viên ca',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    onSaveItem(payload, Boolean(editingId));
    resetForm();
  };

  const uniqueDates = Array.from(new Set(items.map((i) => i.dateStr)));

  const filteredItems = items.filter((item) => {
    const matchesDate = filterDate === 'all' || item.dateStr === filterDate;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.itemName.toLowerCase().includes(q) ||
      item.dateStr.toLowerCase().includes(q);
    return matchesDate && matchesSearch;
  });

  const formatStockWasteDisplay = (item: InventoryCheckItem) => {
    const u = item.unit || '';
    const hasStock = Number(item.stockQty) > 0;
    const hasWaste = Number(item.wasteQty) > 0;

    if (item.statusType === 'ton' || (hasStock && !hasWaste)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-xs">
          Tồn: {item.stockQty} {u}
        </span>
      );
    }
    if (item.statusType === 'huy' || (!hasStock && hasWaste)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-xs">
          Hủy: {item.wasteQty} {u}
        </span>
      );
    }
    return (
      <div className="inline-flex flex-wrap items-center justify-end gap-1">
        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-xs">
          Tồn: {item.stockQty || 0} {u}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-xs">
          Hủy: {item.wasteQty || 0} {u}
        </span>
      </div>
    );
  };

  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;
    const headers = ['Ngày', 'Tên mặt hàng', 'Số lượng Tồn', 'Số lượng Hủy', 'Định lượng', 'Người kiểm'];
    const rows = filteredItems.map((i) => [
      `"${i.dateStr}"`,
      `"${i.itemName.replace(/"/g, '""')}"`,
      `"${i.stockQty || '0'}"`,
      `"${i.wasteQty || '0'}"`,
      `"${i.unit || ''}"`,
      `"${i.createdBy || ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ton_Kiem_Bep_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Form Nhập Số Lượng Tồn Kiểm */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-950">
                {editingId ? 'Sửa Dòng Tồn Kiểm' : 'Lưu Số Lượng Tồn Kiểm'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Ghi nhận nhanh theo 3 cột chuẩn: Ngày • Tên • Số lượng tồn / hủy
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Hủy sửa</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Cột 1: Ngày */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                1. Ngày Kiểm
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => {
                    setDateStr(e.target.value);
                    setFormError('');
                  }}
                  placeholder="DD/MM/YYYY"
                  className="w-full h-10 pl-8 pr-3 bg-zinc-50 border border-zinc-300 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </div>
            </div>

            {/* Cột 2: Tên nguyên liệu / hàng hóa */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                2. Tên Mặt Hàng / Nguyên Liệu <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setFormError('');
                }}
                placeholder="VD: Thăn bò Úc, Sốt kem tươi, Rau xà lách..."
                className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Cột 3: Loại ghi nhận (Tồn / Hủy / Cả hai) */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                3. Phân Loại Tồn / Hủy
              </label>
              <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 rounded-xl h-10">
                <button
                  type="button"
                  onClick={() => setStatusType('ton')}
                  className={`rounded-lg text-xs font-bold transition ${
                    statusType === 'ton'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Tồn kho
                </button>
                <button
                  type="button"
                  onClick={() => setStatusType('huy')}
                  className={`rounded-lg text-xs font-bold transition ${
                    statusType === 'huy'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Báo hủy
                </button>
                <button
                  type="button"
                  onClick={() => setStatusType('both')}
                  className={`rounded-lg text-xs font-bold transition ${
                    statusType === 'both'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Tồn & Hủy
                </button>
              </div>
            </div>
          </div>

          {/* Hàng nhập Số Lượng Tồn / Hủy (chỉ cho phép nhập số) + Định lượng */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
            {(statusType === 'ton' || statusType === 'both') && (
              <div className={statusType === 'both' ? 'sm:col-span-4' : 'sm:col-span-6'}>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  Số Lượng Tồn (chỉ ghi số)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockQty}
                  onChange={(e) => {
                    setStockQty(sanitizeNumericInput(e.target.value));
                    setFormError('');
                  }}
                  placeholder="Nhập số tồn (VD: 4.5)"
                  className="w-full h-9 px-3 bg-white border border-emerald-300 rounded-lg text-sm font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>
            )}

            {(statusType === 'huy' || statusType === 'both') && (
              <div className={statusType === 'both' ? 'sm:col-span-4' : 'sm:col-span-6'}>
                <label className="block text-xs font-bold text-rose-800 mb-1">
                  Số Lượng Hủy (chỉ ghi số)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={wasteQty}
                  onChange={(e) => {
                    setWasteQty(sanitizeNumericInput(e.target.value));
                    setFormError('');
                  }}
                  placeholder="Nhập số hủy (VD: 0.5)"
                  className="w-full h-9 px-3 bg-white border border-rose-300 rounded-lg text-sm font-mono font-bold text-rose-900 focus:ring-2 focus:ring-rose-600 outline-none"
                />
              </div>
            )}

            <div className={statusType === 'both' ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Định Lượng
              </label>
              <input
                type="text"
                list="inventory-unit-options"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg, g, ml, phần..."
                className="w-full h-9 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm font-semibold text-zinc-800 focus:ring-2 focus:ring-zinc-900 outline-none"
              />
              <datalist id="inventory-unit-options">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div className={statusType === 'both' ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <button
                type="submit"
                className="w-full h-9 px-4 bg-zinc-950 hover:bg-zinc-800 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                {editingId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Lưu Sửa' : 'Lưu Tồn Kiểm'}</span>
              </button>
            </div>
          </div>

          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {formError}
            </div>
          )}
        </form>
      </div>

      {/* Bảng Danh Sách Số Lượng Tồn Kiểm (3 Cột: Ngày | Tên | Số lượng tồn / hủy) */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-zinc-950">
              Bảng Lưu Số Lượng Tồn Kiểm
            </h3>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 text-zinc-800">
              {filteredItems.length} mục
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-8 px-2.5 text-xs font-semibold bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-800 outline-none"
            >
              <option value="all">Tất cả ngày ({items.length})</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  Ngày: {d}
                </option>
              ))}
            </select>

            <div className="relative min-w-[160px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên mặt hàng..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* Bảng 3 Cột Chuẩn: Ngày | Tên | Số lượng tồn / hủy */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 bg-zinc-950 text-white px-3 sm:px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider items-center">
            <div className="col-span-3 sm:col-span-3">Ngày</div>
            <div className="col-span-5 sm:col-span-5">Tên</div>
            <div className="col-span-4 sm:col-span-4 text-right">Số lượng tồn / hủy</div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 bg-zinc-50 text-xs sm:text-sm">
              Chưa có dữ liệu tồn kiểm nào. Hãy nhập ở khung bên trên!
            </div>
          ) : (
            <div className="divide-y divide-zinc-200/80 bg-white">
              {filteredItems.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-12 px-3 sm:px-4 py-3 items-center gap-2 hover:bg-zinc-50/80 transition text-xs sm:text-sm"
                >
                  {/* Cột 1: Ngày */}
                  <div className="col-span-3 sm:col-span-3 pr-1">
                    <div className="font-mono font-bold text-zinc-900 text-xs sm:text-sm">
                      {row.dateStr}
                    </div>
                    {row.createdAt && (
                      <div className="text-[10px] text-zinc-400 truncate">
                        {row.createdAt}
                      </div>
                    )}
                  </div>

                  {/* Cột 2: Tên */}
                  <div className="col-span-5 sm:col-span-5 pr-2 min-w-0">
                    <div className="font-semibold text-zinc-950 break-words leading-snug">
                      {row.itemName}
                    </div>
                    {row.createdBy && (
                      <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                        Kiểm bởi: {row.createdBy}
                      </div>
                    )}
                  </div>

                  {/* Cột 3: Số lượng tồn / hủy + thao tác */}
                  <div className="col-span-4 sm:col-span-4 flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                    {formatStockWasteDisplay(row)}

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(row)}
                        className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center transition"
                        title="Sửa dòng này"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {confirmDeleteId === row.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteItem(row.id);
                            setConfirmDeleteId(null);
                          }}
                          className="h-7 px-2 rounded-lg bg-rose-600 text-white text-[10px] font-bold whitespace-nowrap"
                        >
                          Xóa
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(row.id)}
                          className="w-7 h-7 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
