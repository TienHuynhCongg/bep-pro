import React, { useState, useEffect, useMemo } from 'react';
import { InventoryCheckItem, StaffUser, KitchenRecipe, CustomOrderItem } from '../types.ts';
import { DEFAULT_CUSTOM_ORDERS } from '../defaultData.ts';
import {
  PackageCheck,
  ShoppingCart,
  Receipt,
  FileDown,
  Save,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Search,
  Lock,
  Star,
  Copy,
  ChevronDown,
} from 'lucide-react';

interface InventoryCheckViewProps {
  items: InventoryCheckItem[];
  onSaveItem: (item: InventoryCheckItem, isEdit: boolean) => void;
  onDeleteItem: (id: string) => void;
  onSaveDailyTable?: (dateStr: string, updatedAllItems: InventoryCheckItem[]) => void;
  onDeleteDateTable?: (dateStr: string) => void;
  currentUser?: StaffUser | null;
  recipes?: KitchenRecipe[];
  initialOpenOrderList?: boolean;
  onCloseOrderListModal?: () => void;
}

const COMMON_UNITS = [
  'kg',
  'g',
  'ml',
  'lít',
  'phần',
  'hộp',
  'bịch',
  'cái',
  'khay',
  'chai',
  'can',
  'thùng',
  'quả',
  'gói',
  'bó',
  'miếng',
];

const ORDER_UNITS = [
  'Kg',
  'Thùng',
  'Can',
  'Hộp',
  'Miếng',
  'Gói',
  'Gram',
  'Lít',
  'Bó',
  'Chai',
  'Quả',
];

interface VoucherItemRow {
  dish: string;
  quantity: number;
}

interface RecipeIngredientMap {
  [dishName: string]: Array<{ item: string; qty: number }>;
}

const DEFAULT_RECIPE_MAPPING: RecipeIngredientMap = {
  'Cá hồi sốt teri': [{ item: 'Cá hồi phi lê', qty: 1 }],
  'Cơm tấm sườn bì chả': [
    { item: 'Sườn heo', qty: 1 },
    { item: 'Trứng vịt', qty: 1 },
  ],
  'Bò lúc lắc': [
    { item: 'Thịt bò phi lê', qty: 1 },
    { item: 'Ớt chuông', qty: 1 },
  ],
  'Mì ý sốt bò bằm': [
    { item: 'Thịt bò xay', qty: 1 },
    { item: 'Sợi mì ý', qty: 1 },
  ],
  'Salad cá ngừ': [
    { item: 'Cá ngừ hộp', qty: 1 },
    { item: 'Xà lách', qty: 1 },
  ],
};

function sanitizeNumericInput(raw: string): string {
  const normalized = String(raw).replace(/,/g, '.');
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
  recipes = [],
  initialOpenOrderList = false,
  onCloseOrderListModal,
}) => {
  const todayStr = new Date().toLocaleDateString('vi-VN');
  const isAdmin = currentUser?.role === 'admin';

  // Quản lý ngày
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;

  // Danh sách các ngày
  const existingDates = useMemo(() => {
    const set = new Set<string>([todayStr, ...items.map((i) => i.dateStr).filter(Boolean)]);
    return Array.from(set);
  }, [items, todayStr]);

  // Local working copy để nhập liệu mượt mà
  const [localItems, setLocalItems] = useState<InventoryCheckItem[]>(items);
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Tìm kiếm
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [justSavedBanner, setJustSavedBanner] = useState<boolean>(false);

  // Custom Order Items (Hàng đặt cố định như nước rửa chén, khăn giấy, màng bọc...)
  const [customOrders, setCustomOrders] = useState<CustomOrderItem[]>(() => {
    try {
      const saved = localStorage.getItem('kitchen_inventory_custom_orders_v1');
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_ORDERS;
    } catch {
      return DEFAULT_CUSTOM_ORDERS;
    }
  });

  const saveCustomOrders = (nextList: CustomOrderItem[]) => {
    setCustomOrders(nextList);
    try {
      localStorage.setItem('kitchen_inventory_custom_orders_v1', JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  // Recipe Mapping cho Kiểm Phiếu Nhanh
  const [recipeMap, setRecipeMap] = useState<RecipeIngredientMap>(() => {
    try {
      const saved = localStorage.getItem('kitchen_inventory_voucher_recipe_map_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const combined: RecipeIngredientMap = { ...DEFAULT_RECIPE_MAPPING };
    if (Array.isArray(recipes)) {
      recipes.forEach((r) => {
        if (r.dishName && Array.isArray(r.ingredients) && r.ingredients.length > 0) {
          combined[r.dishName] = r.ingredients.map((ing) => ({
            item: ing.name,
            qty: parseFloat(ing.quantity) || 1,
          }));
        }
      });
    }
    return combined;
  });

  // Modals state
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isOrderListModalOpen, setIsOrderListModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAddCustomOrderModalOpen, setIsAddCustomOrderModalOpen] = useState(false);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState(false);

  useEffect(() => {
    if (initialOpenOrderList) {
      setIsOrderListModalOpen(true);
    }
  }, [initialOpenOrderList]);

  // Đóng modal đặt hàng và báo ra ngoài nếu cần
  const handleCloseOrderModal = () => {
    setIsOrderListModalOpen(false);
    onCloseOrderListModal?.();
  };

  // Voucher rows state
  const [voucherRows, setVoucherRows] = useState<VoucherItemRow[]>([
    { dish: 'Cá hồi sốt teri', quantity: 1 },
  ]);

  // Order List selections & custom quantities
  const [orderSelection, setOrderSelection] = useState<Record<string, boolean>>({});
  const [orderQuantities, setOrderQuantities] = useState<
    Record<string, { qty: number; unit: string }>
  >({});

  // Add Item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemStt, setNewItemStt] = useState<number>(1);
  const [newItemThreshold, setNewItemThreshold] = useState<number>(3);
  const [newItemInitialStock, setNewItemInitialStock] = useState<string>('10');
  const [newItemUnit, setNewItemUnit] = useState<string>('kg');

  // Add Custom Order form state
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomQty, setNewCustomQty] = useState<number>(2);
  const [newCustomUnit, setNewCustomUnit] = useState<string>('Can');

  // Các dòng của ngày đang chọn
  const rowsForSelectedDate = localItems.filter((i) => i.dateStr === selectedDate);

  // Hàm tính toán tồn hôm trước tự động từ ngày trước đó
  const getPreviousDayStock = (dateStr: string, itemName: string): number => {
    const otherDates = existingDates.filter((d) => d !== dateStr);
    for (const pastDate of otherDates) {
      const found = localItems.find(
        (i) => i.dateStr === pastDate && i.itemName.toLowerCase() === itemName.toLowerCase()
      );
      if (found && found.stockQty !== undefined) {
        return parseFloat(found.stockQty) || 0;
      }
    }
    const currentItem = localItems.find(
      (i) => i.dateStr === dateStr && i.itemName.toLowerCase() === itemName.toLowerCase()
    );
    if (currentItem?.prevStock !== undefined) {
      return parseFloat(currentItem.prevStock) || 0;
    }
    return 0;
  };

  // Tự động khởi tạo mặt hàng cho ngày mới nếu ngày đó chưa có dữ liệu
  const handleAutoPopulateDate = (targetDate: string) => {
    const existing = localItems.filter((i) => i.dateStr === targetDate);
    if (existing.length > 0) return;

    // Lấy danh sách mặt hàng của ngày gần nhất
    const otherDate = existingDates.find((d) => d !== targetDate) || todayStr;
    const baseItems = localItems.filter((i) => i.dateStr === otherDate);

    if (baseItems.length > 0) {
      const clonedRows: InventoryCheckItem[] = baseItems.map((item, idx) => {
        const prevEndingStock = parseFloat(item.stockQty) || 0;
        return {
          id: `inv-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          stt: item.stt || idx + 1,
          dateStr: targetDate,
          itemName: item.itemName,
          prevStock: String(prevEndingStock),
          importQty: '0',
          stockQty: String(prevEndingStock),
          wasteQty: '0',
          minThreshold: item.minThreshold ?? 3,
          unit: item.unit || 'kg',
          statusType: 'ton',
          createdBy: currentUser?.fullName || 'Nhân viên',
          createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
      });

      const nextAll = [...localItems, ...clonedRows];
      setLocalItems(nextAll);
      if (onSaveDailyTable) {
        onSaveDailyTable(targetDate, nextAll);
      }
    }
  };

  // Đổi ngày đang xem
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    handleAutoPopulateDate(date);
  };

  // Cập nhật ô trong bảng:
  // - Nếu đổi Nhập Vào: Tồn = Tồn Hôm Trước + Nhập Vào
  // - Nếu đổi Tồn: Nhập Vào = max(Tồn - Tồn Hôm Trước, 0)
  const handleCellChange = (
    id: string,
    field: 'itemName' | 'importQty' | 'stockQty' | 'wasteQty' | 'unit' | 'minThreshold' | 'stt',
    rawValue: any
  ) => {
    setLocalItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const prevStockNum = parseFloat(row.prevStock || '0') || getPreviousDayStock(row.dateStr, row.itemName);

        let nextRow = { ...row };

        if (field === 'importQty') {
          const importNum = parseFloat(sanitizeNumericInput(String(rawValue))) || 0;
          const calculatedStock = prevStockNum + importNum;
          nextRow = {
            ...nextRow,
            prevStock: String(prevStockNum),
            importQty: String(importNum),
            stockQty: String(calculatedStock),
          };
        } else if (field === 'stockQty') {
          const stockNum = parseFloat(sanitizeNumericInput(String(rawValue))) || 0;
          const calculatedImport = Math.max(stockNum - prevStockNum, 0);
          nextRow = {
            ...nextRow,
            prevStock: String(prevStockNum),
            stockQty: String(stockNum),
            importQty: String(calculatedImport),
          };
        } else if (field === 'wasteQty') {
          nextRow.wasteQty = sanitizeNumericInput(String(rawValue));
        } else if (field === 'minThreshold') {
          nextRow.minThreshold = parseInt(rawValue, 10) || 0;
        } else if (field === 'stt') {
          nextRow.stt = parseInt(rawValue, 10) || 1;
        } else {
          (nextRow as any)[field] = rawValue;
        }

        return nextRow;
      })
    );
  };

  // Khi rời ô (onBlur), lưu ngầm để đồng bộ không làm hiện thông báo
  const handleCellBlur = (id: string) => {
    const updated = localItems.find((r) => r.id === id);
    if (!updated) return;
    onSaveItem(updated, true);
  };

  // Đếm số lượng mặt hàng cần đặt (Tồn <= Ngưỡng Đặt) + Hàng đặt cố định
  const lowStockCount = useMemo(() => {
    let count = 0;
    rowsForSelectedDate.forEach((item) => {
      const threshold = item.minThreshold ?? 3;
      const currentStock = parseFloat(item.stockQty) || 0;
      if (currentStock <= threshold) {
        count++;
      }
    });
    return count + customOrders.length;
  }, [rowsForSelectedDate, customOrders]);

  // Lọc bảng theo tìm kiếm
  const filteredRows = rowsForSelectedDate
    .filter((row) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        row.itemName.toLowerCase().includes(q) ||
        (row.unit || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.stt || 0) - (b.stt || 0));

  // Lưu toàn bộ bảng ngày đang chọn
  const handleSaveCurrentDateTable = () => {
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, localItems);
    } else {
      rowsForSelectedDate.forEach((row) => onSaveItem(row, true));
    }
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 2500);
  };

  // Thêm mặt hàng mới (Admin)
  const handleAddNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newItemName.trim()) return;

    const exists = rowsForSelectedDate.some(
      (i) => i.itemName.toLowerCase() === newItemName.trim().toLowerCase()
    );
    if (exists) {
      alert('Mặt hàng này đã có trong bảng ngày hôm nay!');
      return;
    }

    const initStockNum = parseFloat(newItemInitialStock) || 0;
    const newRow: InventoryCheckItem = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      stt: newItemStt,
      dateStr: selectedDate,
      itemName: newItemName.trim(),
      prevStock: String(initStockNum),
      importQty: '0',
      stockQty: String(initStockNum),
      wasteQty: '0',
      minThreshold: newItemThreshold,
      unit: newItemUnit,
      statusType: 'ton',
      createdBy: currentUser?.fullName || 'Bếp Trưởng (Admin)',
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const next = [...localItems, newRow];
    setLocalItems(next);
    onSaveItem(newRow, false);
    setIsAddItemModalOpen(false);
    setNewItemName('');
    setNewItemStt((prev) => prev + 1);
  };

  // Xóa 1 dòng (Chỉ Admin)
  const handleDeleteRow = (id: string, name: string) => {
    if (!isAdmin) {
      alert('Chỉ Admin mới có quyền xóa mặt hàng!');
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa mặt hàng "${name}" khỏi bảng?`)) return;
    const next = localItems.filter((i) => i.id !== id);
    setLocalItems(next);
    onDeleteItem(id);
  };

  // Xóa cả bảng ngày (Chỉ Admin)
  const handleDeleteCurrentDateTable = () => {
    if (!isAdmin || !onDeleteDateTable) return;
    onDeleteDateTable(selectedDate);
    setConfirmDeleteDate(false);
    setSelectedDate(todayStr);
  };

  // Thêm hàng đặt cố định mới (Chỉ Admin)
  const handleAddCustomOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newCustomName.trim()) return;

    const newObj: CustomOrderItem = {
      id: `custom_${Date.now()}`,
      name: newCustomName.trim(),
      defaultQty: newCustomQty || 1,
      unit: newCustomUnit,
    };
    saveCustomOrders([...customOrders, newObj]);
    setNewCustomName('');
    setIsAddCustomOrderModalOpen(false);
  };

  // Xóa hàng đặt cố định (Chỉ Admin)
  const handleDeleteCustomOrder = (id: string) => {
    if (!isAdmin) return;
    saveCustomOrders(customOrders.filter((c) => c.id !== id));
  };

  // Đặt hàng nhanh theo dòng cho mọi role
  const handleQuickOrderItem = (item: InventoryCheckItem) => {
    const keyId = `inv_${item.id}`;
    const threshold = item.minThreshold ?? 3;
    const currentStock = parseFloat(item.stockQty) || 0;
    const defaultOrderQty = Math.max(1, threshold * 2 - currentStock);

    setOrderSelection((prev) => ({
      ...prev,
      [keyId]: true,
    }));
    if (!orderQuantities[keyId]) {
      setOrderQuantities((prev) => ({
        ...prev,
        [keyId]: {
          qty: defaultOrderQty,
          unit: item.unit || 'Kg',
        },
      }));
    }
    setIsOrderListModalOpen(true);
  };

  // Kiểm Phiếu Nhanh: Thêm dòng món
  const addVoucherRow = () => {
    const availableDishes = Object.keys(recipeMap);
    const defaultDish = availableDishes[0] || 'Cá hồi sốt teri';
    setVoucherRows([...voucherRows, { dish: defaultDish, quantity: 1 }]);
  };

  const removeVoucherRow = (index: number) => {
    setVoucherRows(voucherRows.filter((_, i) => i !== index));
  };

  // Áp dụng kiểm phiếu vào tồn kho
  const applyVoucherToInventory = () => {
    // Tính tổng định lượng nguyên liệu tiêu thụ
    const deductionMap: Record<string, number> = {};
    voucherRows.forEach((row) => {
      const ingredients = recipeMap[row.dish] || [];
      ingredients.forEach((ing) => {
        const key = ing.item.toLowerCase();
        deductionMap[key] = (deductionMap[key] || 0) + ing.qty * row.quantity;
      });
    });

    const updated = localItems.map((item) => {
      if (item.dateStr !== selectedDate) return item;
      const key = item.itemName.toLowerCase();
      const used = deductionMap[key] || 0;
      if (used <= 0) return item;

      const prev = parseFloat(item.prevStock || '0') || getPreviousDayStock(item.dateStr, item.itemName);
      const targetStock = Math.max(prev - used, 0);
      const neededImport = targetStock - prev >= 0 ? targetStock - prev : 0;

      return {
        ...item,
        stockQty: String(targetStock),
        importQty: String(neededImport),
      };
    });

    setLocalItems(updated);
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, updated);
    }
    setIsVoucherModalOpen(false);
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 2500);
  };

  // Xuất file text Bảng Tồn Kho
  const exportInventoryToText = () => {
    let content = `BẢNG TỒN KHO NGÀY ${selectedDate}\n\n`;
    content += `STT | Tên Mặt Hàng        | Tồn Trước | Nhập | Tồn | Hủy | Đơn Vị\n`;
    content += `--------------------------------------------------------------------\n`;

    filteredRows.forEach((item) => {
      const prev = getPreviousDayStock(selectedDate, item.itemName);
      const imp = item.importQty || '0';
      const stock = item.stockQty || String(prev);
      const waste = item.wasteQty || '0';
      const sttStr = String(item.stt || 1).padEnd(3);
      const nameStr = item.itemName.padEnd(20);
      const prevStr = String(prev).padEnd(9);
      const impStr = String(imp).padEnd(4);
      const stockStr = String(stock).padEnd(4);
      const wasteStr = String(waste).padEnd(4);
      const unitStr = item.unit || 'kg';

      content += `${sttStr} | ${nameStr} | ${prevStr} | ${impStr} | ${stockStr} | ${wasteStr} | ${unitStr}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeDate = selectedDate.replace(/\//g, '-');
    a.download = `TonKho_${safeDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Xuất file text Danh Sách Đặt Hàng
  const exportOrderListToText = () => {
    let content = `DANH SÁCH ĐẶT HÀNG NGÀY ${selectedDate}\n\n`;
    content += `STT  | Tên Mặt Hàng         | Số Lượng Đặt | Đơn Vị\n`;
    content += `------------------------------------------------------\n`;

    let count = 0;
    // 1. Mặt hàng thiếu trong bảng tồn
    rowsForSelectedDate.forEach((item) => {
      const threshold = item.minThreshold ?? 3;
      const currentStock = parseFloat(item.stockQty) || 0;
      if (currentStock <= threshold) {
        const keyId = `inv_${item.id}`;
        if (orderSelection[keyId] !== false) {
          count++;
          const orderData = orderQuantities[keyId] || {
            qty: Math.max(1, threshold * 2 - currentStock),
            unit: item.unit || 'Kg',
          };
          const sttStr = String(item.stt || count).padEnd(4);
          const nameStr = item.itemName.padEnd(20);
          const qtyStr = String(orderData.qty).padEnd(12);
          content += `${sttStr} | ${nameStr} | ${qtyStr} | ${orderData.unit}\n`;
        }
      }
    });

    // 2. Mặt hàng đặt cố định
    customOrders.forEach((customItem, idx) => {
      const keyId = `custom_${customItem.id}`;
      if (orderSelection[keyId] !== false) {
        count++;
        const orderData = orderQuantities[keyId] || {
          qty: customItem.defaultQty,
          unit: customItem.unit,
        };
        const sttStr = `CD-${idx + 1}`.padEnd(4);
        const nameStr = customItem.name.padEnd(20);
        const qtyStr = String(orderData.qty).padEnd(12);
        content += `${sttStr} | ${nameStr} | ${qtyStr} | ${orderData.unit}\n`;
      }
    });

    if (count === 0) {
      alert('Vui lòng chọn ít nhất 1 mặt hàng để xuất file đặt hàng!');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeDate = selectedDate.replace(/\//g, '-');
    a.download = `DanhSachDatHang_${safeDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner - Tồn Kho & Kiểm Phiếu */}
      <div className="bg-zinc-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-zinc-800">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 text-emerald-400 shrink-0 shadow-2xs">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Kiểm Kê Tồn Kho
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  Ngày: <strong className="text-white">{selectedDate}</strong>
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Quyền Admin</span>
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white mt-0.5">
                Quản Lý Tồn Kho & Kiểm Phiếu
              </h2>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Chọn Ngày */}
            <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 mr-1.5" />
              <select
                value={selectedDate}
                onChange={(e) => handleSelectDate(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer pr-1"
              >
                {existingDates.map((d) => (
                  <option key={d} value={d} className="bg-zinc-900 text-white">
                    {d === todayStr ? `Hôm nay (${d})` : `Ngày ${d}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Nút Danh Sách Đặt Hàng */}
            <button
              type="button"
              onClick={() => setIsOrderListModalOpen(true)}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1.5 shrink-0 shadow-xs relative"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Đặt Hàng</span>
              {lowStockCount > 0 && (
                <span className="bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full shadow-xs animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </button>

            {/* Nút Kiểm Phiếu Nhanh */}
            <button
              type="button"
              onClick={() => setIsVoucherModalOpen(true)}
              disabled={!isToday}
              className={`h-8 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs ${
                isToday
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              title={isToday ? 'Kiểm phiếu bán trong ca' : 'Chỉ mở kiểm phiếu cho ngày hôm nay'}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Kiểm Phiếu</span>
            </button>

            {/* Nút Xuất File Text */}
            <button
              type="button"
              onClick={exportInventoryToText}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition flex items-center gap-1.5 shrink-0"
              title="Tải bảng tồn thành file .txt"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Xuất Text</span>
            </button>

            {/* Nút Lưu Bảng */}
            <button
              type="button"
              onClick={handleSaveCurrentDateTable}
              className="h-8 px-3.5 rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-100 transition flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* Thông báo đã lưu thành công */}
      {justSavedBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Đã lưu bảng tồn kho ngày {selectedDate} thành công!</span>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="bg-white rounded-2xl shadow-xs border border-zinc-200 p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm tên hàng hóa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                const maxStt = rowsForSelectedDate.length > 0 ? Math.max(...rowsForSelectedDate.map((i) => i.stt || 1)) + 1 : 1;
                setNewItemStt(maxStt);
                setIsAddItemModalOpen(true);
              }}
              className="h-8 px-3.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Hàng Mới</span>
            </button>
          )}

          {isAdmin && rowsForSelectedDate.length > 0 && (
            confirmDeleteDate ? (
              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={handleDeleteCurrentDateTable}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold"
                >
                  Xác nhận xóa bảng
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteDate(false)}
                  className="px-2 py-1 text-xs text-zinc-600 font-semibold"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteDate(true)}
                className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-bold transition flex items-center gap-1"
                title="Chỉ Admin được xóa bảng ngày"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Bảng Ngày</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-14 text-center">STT</th>
                <th className="py-3 px-3 min-w-[180px]">Tên Hàng</th>
                <th className="py-3 px-3 w-28 text-right">Tồn Trước</th>
                <th className="py-3 px-3 w-28 text-right">Nhập Vào</th>
                <th className="py-3 px-3 w-28 text-right">Tồn</th>
                <th className="py-3 px-3 w-24 text-right">Hủy</th>
                <th className="py-3 px-3 w-24 text-center">Đơn Vị</th>
                <th className="py-3 px-3 w-20 text-center">Đặt Hàng</th>
                {isAdmin && <th className="py-3 px-3 w-24 text-center">Ngưỡng Đặt</th>}
                {isAdmin && <th className="py-3 px-3 w-16 text-center">Xóa</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 8} className="py-12 text-center text-zinc-400">
                    Chưa có mặt hàng nào cho ngày {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredRows.map((item, idx) => {
                  const prevStock = getPreviousDayStock(selectedDate, item.itemName);
                  const currentStockNum = parseFloat(item.stockQty) || 0;
                  const threshold = item.minThreshold ?? 3;
                  const isLowStock = currentStockNum <= threshold;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/80 transition border-b border-zinc-100"
                    >
                      {/* STT */}
                      <td className="py-2.5 px-3 text-center font-semibold text-zinc-500">
                        {isAdmin ? (
                          <input
                            type="number"
                            value={item.stt || idx + 1}
                            onChange={(e) => handleCellChange(item.id, 'stt', e.target.value)}
                            onBlur={() => handleCellBlur(item.id)}
                            className="w-12 text-center bg-zinc-100 border border-zinc-200 rounded-lg py-1 font-bold outline-none"
                          />
                        ) : (
                          item.stt || idx + 1
                        )}
                      </td>

                      {/* Tên Hàng */}
                      <td className="py-2.5 px-3 font-medium text-zinc-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isAdmin ? (
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleCellChange(item.id, 'itemName', e.target.value)}
                              onBlur={() => handleCellBlur(item.id)}
                              className="font-bold text-zinc-900 bg-transparent border-b border-dashed border-zinc-300 focus:border-emerald-600 outline-none w-full py-0.5"
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900">{item.itemName}</span>
                          )}

                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                              <Star className="w-2.5 h-2.5 fill-rose-600 text-rose-600" />
                              <span>Cần Đặt</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tồn Hôm Trước */}
                      <td className="py-2.5 px-3 text-right font-semibold text-zinc-600 bg-zinc-50/50">
                        {prevStock}
                      </td>

                      {/* Nhập Vào */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.importQty || '0'}
                          onChange={(e) => handleCellChange(item.id, 'importQty', e.target.value)}
                          onBlur={() => handleCellBlur(item.id)}
                          className="w-20 text-right bg-zinc-50 focus:bg-white border border-zinc-200 rounded-lg px-2 py-1 font-bold text-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Tồn Hiện Tại */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.stockQty}
                          onChange={(e) => handleCellChange(item.id, 'stockQty', e.target.value)}
                          onBlur={() => handleCellBlur(item.id)}
                          className="w-20 text-right bg-emerald-50 focus:bg-white border border-emerald-300 rounded-lg px-2 py-1 font-bold text-emerald-800 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Hủy */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.wasteQty || '0'}
                          onChange={(e) => handleCellChange(item.id, 'wasteQty', e.target.value)}
                          onBlur={() => handleCellBlur(item.id)}
                          className="w-16 text-right bg-zinc-50 focus:bg-white border border-zinc-200 rounded-lg px-2 py-1 text-zinc-700 outline-none"
                        />
                      </td>

                      {/* Đơn Vị */}
                      <td className="py-2.5 px-3 text-center">
                        <select
                          value={item.unit || 'kg'}
                          onChange={(e) => handleCellChange(item.id, 'unit', e.target.value)}
                          onBlur={() => handleCellBlur(item.id)}
                          className="bg-zinc-50 border border-zinc-200 rounded-lg px-1.5 py-1 text-xs outline-none"
                        >
                          {COMMON_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Đặt Hàng theo dòng (Cho tất cả các role) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickOrderItem(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/30 transition shadow-2xs active:scale-95"
                          title={`Đặt hàng cho ${item.itemName}`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                          <span>Đặt</span>
                        </button>
                      </td>

                      {/* Ngưỡng Đặt (Admin) */}
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={threshold}
                            onChange={(e) => handleCellChange(item.id, 'minThreshold', e.target.value)}
                            onBlur={() => handleCellBlur(item.id)}
                            className="w-14 text-center bg-amber-50 border border-amber-200 rounded-lg py-1 font-bold text-amber-900 outline-none"
                          />
                        </td>
                      )}

                      {/* Thao Tác (Admin) */}
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(item.id, item.itemName)}
                            className="p-1 text-zinc-400 hover:text-rose-600 rounded-lg transition"
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Kiểm Phiếu Nhanh (VoucherModal) */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 max-h-[90vh] flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Kiểm Phiếu Bán Hàng</h3>
                  <p className="text-xs text-zinc-500">
                    Chọn các món đã bán trong ca để hệ thống tự động trừ nguyên liệu tồn kho.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Danh sách món bán
                </span>
                <button
                  type="button"
                  onClick={addVoucherRow}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Món</span>
                </button>
              </div>

              {voucherRows.map((row, idx) => {
                const ingredients = recipeMap[row.dish] || [];

                return (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-0.5">
                          Tên Món
                        </label>
                        <select
                          value={row.dish}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVoucherRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, dish: val } : r))
                            );
                          }}
                          className="w-full p-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold outline-none"
                        >
                          {Object.keys(recipeMap).map((dish) => (
                            <option key={dish} value={dish}>
                              {dish}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-0.5">
                          Số Phần Bán
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setVoucherRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r))
                            );
                          }}
                          className="w-full p-2 text-center bg-white border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeVoucherRow(idx)}
                        className="mt-4 p-2 text-zinc-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Hiển thị định lượng nguyên liệu trừ */}
                    {ingredients.length > 0 && (
                      <div className="bg-white p-2 rounded-xl border border-zinc-200/80 flex flex-wrap gap-1.5 text-[11px] text-zinc-600">
                        <span className="font-bold text-zinc-500">Trừ tồn:</span>
                        {ingredients.map((ing, iIdx) => (
                          <span
                            key={iIdx}
                            className="px-2 py-0.5 bg-zinc-100 rounded-md font-semibold text-zinc-800"
                          >
                            {ing.item}: -{ing.qty * row.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={applyVoucherToInventory}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition shadow-xs"
              >
                Áp Dụng Vào Tồn Kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Danh Sách Đặt Hàng (OrderListModal) */}
      {isOrderListModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 max-h-[90vh] flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">
                    Danh Sách Mặt Hàng Cần Đặt Hàng
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Tổng hợp các mặt hàng dưới ngưỡng tồn và hàng đặt cố định để gửi nhà cung cấp.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsAddCustomOrderModalOpen(true)}
                    className="h-8 px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Hàng Cố Định</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseOrderModal}
                  className="text-zinc-400 hover:text-zinc-700 p-1 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={Object.values(orderSelection).every(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const next: Record<string, boolean> = {};
                          rowsForSelectedDate.forEach((i) => {
                            next[`inv_${i.id}`] = val;
                          });
                          customOrders.forEach((c) => {
                            next[`custom_${c.id}`] = val;
                          });
                          setOrderSelection(next);
                        }}
                        className="rounded border-zinc-300 text-amber-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-14 text-center">STT</th>
                    <th className="py-2.5 px-3">Tên Mặt Hàng</th>
                    <th className="py-2.5 px-3 text-right w-24">Tồn Hiện Tại</th>
                    <th className="py-2.5 px-3 text-right w-28">Số Lượng Đặt</th>
                    <th className="py-2.5 px-3 text-center w-28">Định Lượng</th>
                    {isAdmin && <th className="py-2.5 px-3 w-16 text-center">Xóa</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {/* 1. Mặt hàng thiếu trong bảng tồn */}
                  {rowsForSelectedDate
                    .filter((item) => (parseFloat(item.stockQty) || 0) <= (item.minThreshold ?? 3))
                    .map((item) => {
                      const keyId = `inv_${item.id}`;
                      const isSelected = orderSelection[keyId] !== false;
                      const threshold = item.minThreshold ?? 3;
                      const currentStock = parseFloat(item.stockQty) || 0;
                      const defaultOrderQty = Math.max(1, threshold * 2 - currentStock);
                      const currentOrderData = orderQuantities[keyId] || {
                        qty: defaultOrderQty,
                        unit: item.unit || 'Kg',
                      };

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-zinc-50 transition ${
                            isSelected ? 'bg-amber-50/40 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setOrderSelection({
                                  ...orderSelection,
                                  [keyId]: e.target.checked,
                                })
                              }
                              className="rounded border-zinc-300 text-amber-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 text-center text-zinc-500 font-mono">
                            {item.stt}
                          </td>
                          <td className="py-2 px-3 font-medium text-zinc-900">
                            {item.itemName}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-rose-600">
                            {item.stockQty}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="1"
                              value={currentOrderData.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setOrderQuantities({
                                  ...orderQuantities,
                                  [keyId]: { ...currentOrderData, qty: val },
                                });
                              }}
                              className="w-20 text-right bg-white border border-zinc-200 rounded-lg px-2 py-1 font-bold text-amber-800 outline-none"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <select
                              value={currentOrderData.unit}
                              onChange={(e) =>
                                setOrderQuantities({
                                  ...orderQuantities,
                                  [keyId]: { ...currentOrderData, unit: e.target.value },
                                })
                              }
                              className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs outline-none"
                            >
                              {ORDER_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>
                          {isAdmin && <td className="py-2 px-3 text-center text-zinc-400">-</td>}
                        </tr>
                      );
                    })}

                  {/* 2. Mặt hàng đặt cố định */}
                  {customOrders.map((customItem, cIdx) => {
                    const keyId = `custom_${customItem.id}`;
                    const isSelected = orderSelection[keyId] !== false;
                    const currentOrderData = orderQuantities[keyId] || {
                      qty: customItem.defaultQty,
                      unit: customItem.unit,
                    };

                    return (
                      <tr
                        key={customItem.id}
                        className={`hover:bg-zinc-50 transition ${
                          isSelected ? 'bg-indigo-50/40 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              setOrderSelection({
                                ...orderSelection,
                                [keyId]: e.target.checked,
                              })
                            }
                            className="rounded border-zinc-300 text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 text-center text-indigo-600 font-mono font-bold">
                          CD-{cIdx + 1}
                        </td>
                        <td className="py-2 px-3 font-medium text-zinc-900">
                          {customItem.name}
                        </td>
                        <td className="py-2 px-3 text-right italic text-zinc-400">
                          Cố định
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="1"
                            value={currentOrderData.qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setOrderQuantities({
                                ...orderQuantities,
                                [keyId]: { ...currentOrderData, qty: val },
                              });
                            }}
                            className="w-20 text-right bg-white border border-zinc-200 rounded-lg px-2 py-1 font-bold text-indigo-800 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <select
                            value={currentOrderData.unit}
                            onChange={(e) =>
                              setOrderQuantities({
                                ...orderQuantities,
                                [keyId]: { ...currentOrderData, unit: e.target.value },
                              })
                            }
                            className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs outline-none"
                          >
                            {ORDER_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        {isAdmin && (
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomOrder(customItem.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded"
                              title="Xóa hàng cố định"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-zinc-100">
              <span className="text-xs text-zinc-500 font-semibold">
                Tổng cộng: {lowStockCount} mặt hàng cần đặt
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportOrderListToText}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition flex items-center gap-1.5 shadow-xs"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Xuất File Text (Đã Chọn)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseOrderModal}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm Mặt Hàng Mới (Admin) */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Thêm Mặt Hàng Kiểm Kê Mới</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-600 font-bold mb-1">
                  Tên Mặt Hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Cá hồi phi lê, Sườn heo..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">Số Thứ Tự (STT)</label>
                  <input
                    type="number"
                    min="1"
                    value={newItemStt}
                    onChange={(e) => setNewItemStt(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">Ngưỡng Đặt (Báo Thiếu)</label>
                  <input
                    type="number"
                    min="0"
                    value={newItemThreshold}
                    onChange={(e) => setNewItemThreshold(parseInt(e.target.value, 10) || 3)}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">Tồn Ban Đầu</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newItemInitialStock}
                    onChange={(e) => setNewItemInitialStock(sanitizeNumericInput(e.target.value))}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-bold text-emerald-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">Đơn Vị</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-semibold outline-none"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl shadow-xs"
                >
                  Lưu Vào Bảng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Thêm Hàng Đặt Cố Định (Admin) */}
      {isAddCustomOrderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Thêm Hàng Đặt Cố Định</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCustomOrderModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomOrderSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-600 font-bold mb-1">
                  Tên Mặt Hàng Đặt <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nước rửa chén, Khăn giấy rút..."
                  value={newCustomName}
                  onChange={(e) => setNewCustomName(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-semibold outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">Số Lượng Đặt</label>
                  <input
                    type="number"
                    min="1"
                    value={newCustomQty}
                    onChange={(e) => setNewCustomQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">Định Lượng</label>
                  <select
                    value={newCustomUnit}
                    onChange={(e) => setNewCustomUnit(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-semibold outline-none"
                  >
                    {ORDER_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomOrderModalOpen(false)}
                  className="px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs"
                >
                  Lưu Vào Danh Sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
