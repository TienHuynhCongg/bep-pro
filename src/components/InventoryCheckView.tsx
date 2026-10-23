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
  ChevronUp,
  GripVertical,
  Eye,
  Edit2,
  Camera,
  RotateCcw,
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
  onLowStockCountChange?: (count: number) => void;
  onRestoreEmergencyInventory?: () => void;
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
  onLowStockCountChange,
  onRestoreEmergencyInventory,
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

  // 2 Chế độ hiển thị: 'view' (Chỉ xem gọn gàng cho điện thoại) vs 'edit' (Chỉnh sửa số liệu)
  const [tableMode, setTableMode] = useState<'view' | 'edit'>('edit');

  // Kéo thả đổi vị trí mặt hàng
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

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

  const DEFAULT_TABLE_NAME = 'Tủ Mát Chính';
  const CABINET_PRESETS = [
    'Tủ Mát Chính',
    'Tủ Đông 1 (Thịt Cá)',
    'Tủ Đông 2 (Kem & Hải Sản)',
    'Tủ Trữ Rau Củ',
    'Tủ Mát Quầy Ra Món',
    'Kho Khô & Gia Vị',
  ];

  // Danh sách các bảng / tủ đã từng được tạo trên toàn bộ hệ thống
  const allKnownTables = useMemo(() => {
    const set = new Set<string>();
    set.add(DEFAULT_TABLE_NAME);
    localItems.forEach((i) => {
      const name = (i.tableName || DEFAULT_TABLE_NAME).trim();
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [localItems]);

  // Danh sách các bảng / tủ trong ngày đang chọn (luôn bao gồm tất cả các tủ đã có để không bị biến mất khi đổi ngày)
  const existingTablesForDate = useMemo(() => {
    const set = new Set<string>();
    allKnownTables.forEach((t) => set.add(t));
    const dateItems = localItems.filter((i) => i.dateStr === selectedDate);
    dateItems.forEach((i) => {
      const name = (i.tableName || DEFAULT_TABLE_NAME).trim();
      if (name) set.add(name);
    });
    if (set.size === 0) set.add(DEFAULT_TABLE_NAME);
    return Array.from(set);
  }, [allKnownTables, localItems, selectedDate]);

  // Bảng / Tủ đang chọn trong ngày
  const [selectedTable, setSelectedTable] = useState<string>(DEFAULT_TABLE_NAME);

  // Đảm bảo selectedTable luôn hợp lệ khi đổi ngày
  useEffect(() => {
    if (!existingTablesForDate.includes(selectedTable)) {
      setSelectedTable(existingTablesForDate[0] || DEFAULT_TABLE_NAME);
    }
  }, [existingTablesForDate, selectedTable]);

  // Modal thêm bảng / tủ mới
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState<boolean>(false);
  const [newTableNameInput, setNewTableNameInput] = useState<string>('');
  const [cloneFromCurrentTable, setCloneFromCurrentTable] = useState<boolean>(false);

  // Các dòng của ngày VÀ tủ đang chọn
  const rowsForSelectedDateAndTable = useMemo(() => {
    return localItems.filter(
      (i) => i.dateStr === selectedDate && (i.tableName || DEFAULT_TABLE_NAME) === selectedTable
    );
  }, [localItems, selectedDate, selectedTable]);

  // Tất cả các dòng của ngày đang chọn (trên mọi tủ)
  const allRowsForSelectedDate = useMemo(() => {
    return localItems.filter((i) => i.dateStr === selectedDate);
  }, [localItems, selectedDate]);

  // Sắp xếp ngày từ gần nhất đến xa nhất theo chuẩn DD/MM/YYYY
  const sortDatesDesc = (dates: string[]): string[] => {
    return [...dates].sort((a, b) => {
      const parse = (s: string) => {
        const parts = s.split('/');
        if (parts.length === 3) {
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
        }
        return 0;
      };
      return parse(b) - parse(a);
    });
  };

  // Lấy các mặt hàng chuẩn của tủ này từ ngày gần nhất có dữ liệu
  const getLatestItemsForTable = (tableName: string, excludeDate?: string): InventoryCheckItem[] => {
    const curTable = tableName || DEFAULT_TABLE_NAME;
    const pastDates = sortDatesDesc(existingDates.filter((d) => d !== excludeDate));
    for (const d of pastDates) {
      const items = localItems.filter(
        (i) => i.dateStr === d && (i.tableName || DEFAULT_TABLE_NAME) === curTable
      );
      if (items.length > 0) return items;
    }
    return [];
  };

  // Lấy các mặt hàng của tủ này từ các ngày trước đó nếu ngày hiện tại chưa có
  const getPreviousDayItemsForTable = (tableName: string): InventoryCheckItem[] => {
    return getLatestItemsForTable(tableName, selectedDate);
  };

  // TỰ ĐỘNG BẢO TOÀN DANH MỤC CỐ ĐỊNH CHO TẤT CẢ CÁC TỦ KHI SANG NGÀY MỚI
  // Mọi tủ đã từng tồn tại đều sẽ tự động có mặt ở ngày mới với toàn bộ mặt hàng và Tồn hôm trước = Tồn cuối hôm qua
  const ensureAllTablesPopulatedForDate = (targetDate: string) => {
    let nextAll = [...localItems];
    let hasChanges = false;

    for (const tableName of allKnownTables) {
      const currentRows = nextAll.filter(
        (i) => i.dateStr === targetDate && (i.tableName || DEFAULT_TABLE_NAME) === tableName
      );

      const isOnlyDummy =
        currentRows.length === 1 && currentRows[0].itemName.includes('Mặt hàng 1');

      // Nếu tủ này chưa có mặt hàng nào hoặc chỉ có mỗi 1 dòng mẫu "Mặt hàng 1"
      if (currentRows.length === 0 || isOnlyDummy) {
        const baseItems = getLatestItemsForTable(tableName, targetDate).filter(
          (i) => !i.itemName.includes('Mặt hàng 1')
        );

        if (baseItems.length > 0) {
          // Xóa dòng mẫu nếu có
          if (isOnlyDummy) {
            nextAll = nextAll.filter(
              (i) => !(i.dateStr === targetDate && (i.tableName || DEFAULT_TABLE_NAME) === tableName)
            );
          }

          const clonedRows: InventoryCheckItem[] = baseItems.map((item, idx) => {
            const prevEndingStock = parseFloat(item.stockQty) || 0;
            return {
              id: `inv-${Date.now()}-${tableName}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              stt: item.stt || idx + 1,
              dateStr: targetDate,
              tableName: tableName || DEFAULT_TABLE_NAME,
              itemName: item.itemName,
              prevStock: String(prevEndingStock), // Tồn hôm trước tự động lấy từ Tồn cuối ngày trước
              importQty: '0',                     // Nhập mới = 0
              wasteQty: '0',                      // Hủy = 0
              stockQty: String(prevEndingStock),  // Tồn hiện tại bắt đầu bằng Tồn hôm trước
              minThreshold: item.minThreshold ?? 3,
              unit: item.unit || 'kg',
              statusType: 'ton',
              isManualStock: false,
              createdBy: currentUser?.fullName || 'Hệ thống tự động',
              createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            };
          });

          nextAll = [...nextAll, ...clonedRows];
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      setLocalItems(nextAll);
      if (onSaveDailyTable) {
        onSaveDailyTable(targetDate, nextAll);
      }
    }
  };

  // TỰ ĐỘNG NẠP MẶT HÀNG TỦ NGAY KHI CHỌN TỦ (100% Tự động, không cần bấm sao chép)
  useEffect(() => {
    const isOnlyDummy =
      rowsForSelectedDateAndTable.length === 1 &&
      rowsForSelectedDateAndTable[0].itemName.includes('Mặt hàng 1');

    if (rowsForSelectedDateAndTable.length === 0 || isOnlyDummy) {
      const prevItems = getLatestItemsForTable(selectedTable, selectedDate).filter(
        (i) => !i.itemName.includes('Mặt hàng 1')
      );
      if (prevItems.length > 0) {
        const otherItems = localItems.filter(
          (i) => !(i.dateStr === selectedDate && (i.tableName || DEFAULT_TABLE_NAME) === selectedTable)
        );
        const cloned = prevItems.map((item, idx) => {
          const prevEnding = parseFloat(item.stockQty) || 0;
          return {
            id: `inv-${Date.now()}-${selectedTable}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            stt: item.stt || idx + 1,
            dateStr: selectedDate,
            tableName: selectedTable,
            itemName: item.itemName,
            prevStock: String(prevEnding),
            importQty: '0',
            stockQty: String(prevEnding),
            wasteQty: '0',
            minThreshold: item.minThreshold ?? 3,
            unit: item.unit || 'kg',
            statusType: 'ton',
            isManualStock: false,
            createdBy: currentUser?.fullName || 'Hệ thống tự động',
            createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };
        });

        const nextAll = [...otherItems, ...cloned];
        setLocalItems(nextAll);
        if (onSaveDailyTable) {
          onSaveDailyTable(selectedDate, nextAll);
        }
      }
    }
  }, [selectedDate, selectedTable, rowsForSelectedDateAndTable.length, localItems.length]);

  // Tự động kiểm tra và khởi tạo danh mục cố định cho mọi tủ ngay khi mở app hoặc đổi ngày
  useEffect(() => {
    ensureAllTablesPopulatedForDate(selectedDate);
  }, [selectedDate, allKnownTables.length]);

  // Nạp nhanh các mặt hàng của tủ này từ ngày hôm trước
  const handleCopyTableFromPreviousDay = (tableName: string) => {
    ensureAllTablesPopulatedForDate(selectedDate);
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 2500);
  };

  // Hàm tính toán tồn hôm trước tự động từ ngày trước đó
  const getPreviousDayStock = (dateStr: string, itemName: string, tableName?: string): number => {
    const curTable = tableName || selectedTable || DEFAULT_TABLE_NAME;
    const sortedPastDates = sortDatesDesc(existingDates.filter((d) => d !== dateStr));
    for (const pastDate of sortedPastDates) {
      const found = localItems.find(
        (i) =>
          i.dateStr === pastDate &&
          (i.tableName || DEFAULT_TABLE_NAME) === curTable &&
          i.itemName.toLowerCase() === itemName.toLowerCase()
      );
      if (found && found.stockQty !== undefined) {
        return parseFloat(found.stockQty) || 0;
      }
    }
    for (const pastDate of sortedPastDates) {
      const found = localItems.find(
        (i) => i.dateStr === pastDate && i.itemName.toLowerCase() === itemName.toLowerCase()
      );
      if (found && found.stockQty !== undefined) {
        return parseFloat(found.stockQty) || 0;
      }
    }
    const currentItem = localItems.find(
      (i) =>
        i.dateStr === dateStr &&
        (i.tableName || DEFAULT_TABLE_NAME) === curTable &&
        i.itemName.toLowerCase() === itemName.toLowerCase()
    );
    if (currentItem?.prevStock !== undefined) {
      return parseFloat(currentItem.prevStock) || 0;
    }
    return 0;
  };

  // Đổi ngày đang xem
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    ensureAllTablesPopulatedForDate(date);
  };

  // Cập nhật ô trong bảng theo công thức:
  // HÀNG TỒN = NHẬP VÀO + TỒN HÔM TRƯỚC - HỦY
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
          const sanitized = sanitizeNumericInput(String(rawValue));
          const importNum = parseFloat(sanitized) || 0;
          const wasteNum = parseFloat(row.wasteQty || '0') || 0;
          nextRow = {
            ...nextRow,
            prevStock: String(prevStockNum),
            importQty: sanitized,
          };
          // Độ ưu tiên của công thức xếp SAU việc nhập thủ công của users:
          // Chỉ tự động tính tồn nếu user CHƯA từng nhập tay số tồn cho dòng này
          if (!row.isManualStock) {
            const calculatedStock = Math.max(
              Math.round((importNum + prevStockNum - wasteNum) * 1000) / 1000,
              0
            );
            nextRow.stockQty = String(calculatedStock);
          }
        } else if (field === 'wasteQty') {
          const sanitized = sanitizeNumericInput(String(rawValue));
          const wasteNum = parseFloat(sanitized) || 0;
          const importNum = parseFloat(row.importQty || '0') || 0;
          nextRow = {
            ...nextRow,
            prevStock: String(prevStockNum),
            wasteQty: sanitized,
          };
          // Độ ưu tiên của công thức xếp SAU việc nhập thủ công của users:
          if (!row.isManualStock) {
            const calculatedStock = Math.max(
              Math.round((importNum + prevStockNum - wasteNum) * 1000) / 1000,
              0
            );
            nextRow.stockQty = String(calculatedStock);
          }
        } else if (field === 'stockQty') {
          const sanitized = sanitizeNumericInput(String(rawValue));
          // Khi user nhập thủ công vào cột Tồn: Ưu tiên tuyệt đối giá trị user nhập!
          // KHÔNG ép đổi ngược lại cột Nhập
          nextRow = {
            ...nextRow,
            prevStock: String(prevStockNum),
            stockQty: sanitized,
            isManualStock: true, // Đánh dấu đã nhập thủ công
          };
        } else if (field === 'minThreshold') {
          const val = rawValue === '' ? 0 : (parseFloat(rawValue) || 0);
          nextRow.minThreshold = val;
        } else if (field === 'stt') {
          nextRow.stt = parseInt(rawValue, 10) || 1;
        } else {
          (nextRow as any)[field] = rawValue;
        }

        return nextRow;
      })
    );
  };

  // Tính lại tồn kho theo công thức khi người dùng muốn bỏ chế độ nhập tay
  const handleRecalculateRowStock = (id: string) => {
    setLocalItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const prevStockNum = parseFloat(row.prevStock || '0') || getPreviousDayStock(row.dateStr, row.itemName);
        const importNum = parseFloat(row.importQty || '0') || 0;
        const wasteNum = parseFloat(row.wasteQty || '0') || 0;
        const calculatedStock = Math.max(
          Math.round((importNum + prevStockNum - wasteNum) * 1000) / 1000,
          0
        );
        const updatedRow = {
          ...row,
          stockQty: String(calculatedStock),
          isManualStock: false,
        };
        onSaveItem(updatedRow, true);
        return updatedRow;
      })
    );
  };

  // Đổi thứ tự mặt hàng (Kéo thả hoặc bấm mũi tên) trong bảng/tủ đang chọn
  const moveInventoryItemDelta = (itemId: string, direction: -1 | 1) => {
    const sorted = [...rowsForSelectedDateAndTable].sort((a, b) => (a.stt || 0) - (b.stt || 0));
    const curIndex = sorted.findIndex((i) => i.id === itemId);
    if (curIndex === -1) return;
    const targetIndex = curIndex + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const [moved] = sorted.splice(curIndex, 1);
    sorted.splice(targetIndex, 0, moved);
    const updatedWithStt = sorted.map((item, idx) => ({
      ...item,
      stt: idx + 1,
    }));

    const otherItems = localItems.filter(
      (i) => !(i.dateStr === selectedDate && (i.tableName || DEFAULT_TABLE_NAME) === selectedTable)
    );
    const nextAll = [...otherItems, ...updatedWithStt];
    setLocalItems(nextAll);
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, nextAll);
    } else {
      updatedWithStt.forEach((r) => onSaveItem(r, true));
    }
  };

  const moveInventoryItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const sorted = [...rowsForSelectedDateAndTable].sort((a, b) => (a.stt || 0) - (b.stt || 0));
    const curIndex = sorted.findIndex((i) => i.id === fromId);
    const targetIndex = sorted.findIndex((i) => i.id === toId);
    if (curIndex === -1 || targetIndex === -1) return;

    const [moved] = sorted.splice(curIndex, 1);
    sorted.splice(targetIndex, 0, moved);
    const updatedWithStt = sorted.map((item, idx) => ({
      ...item,
      stt: idx + 1,
    }));

    const otherItems = localItems.filter(
      (i) => !(i.dateStr === selectedDate && (i.tableName || DEFAULT_TABLE_NAME) === selectedTable)
    );
    const nextAll = [...otherItems, ...updatedWithStt];
    setLocalItems(nextAll);
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, nextAll);
    } else {
      updatedWithStt.forEach((r) => onSaveItem(r, true));
    }
  };

  // Tạo thêm bảng lưu kiểm tồn mới (Ví dụ tủ đông, tủ rau, tủ quầy...)
  const handleCreateNewTable = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTableNameInput.trim();
    if (!trimmed) {
      alert('Vui lòng nhập tên cho bảng / tủ mới!');
      return;
    }
    if (existingTablesForDate.includes(trimmed)) {
      alert(`Bảng / Tủ "${trimmed}" đã tồn tại trong ngày ${selectedDate}!`);
      return;
    }

    let newItemsToAppend: InventoryCheckItem[] = [];
    if (cloneFromCurrentTable && rowsForSelectedDateAndTable.length > 0) {
      // Sao chép danh mục mặt hàng từ tủ hiện tại sang tủ mới với số tồn đặt về 0
      newItemsToAppend = rowsForSelectedDateAndTable.map((item, idx) => ({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`,
        stt: idx + 1,
        dateStr: selectedDate,
        tableName: trimmed,
        itemName: item.itemName,
        prevStock: '0',
        importQty: '0',
        stockQty: '0',
        wasteQty: '0',
        minThreshold: item.minThreshold ?? 3,
        unit: item.unit || 'kg',
        statusType: 'ton',
        createdBy: currentUser?.fullName || 'Người tạo',
        createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      }));
    } else {
      // Tạo một mặt hàng mẫu để bắt đầu nhập
      newItemsToAppend = [
        {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          stt: 1,
          dateStr: selectedDate,
          tableName: trimmed,
          itemName: 'Mặt hàng 1 (Bấm đổi tên)',
          prevStock: '0',
          importQty: '0',
          stockQty: '0',
          wasteQty: '0',
          minThreshold: 3,
          unit: 'kg',
          statusType: 'ton',
          createdBy: currentUser?.fullName || 'Người tạo',
          createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    }

    const nextAll = [...localItems, ...newItemsToAppend];
    setLocalItems(nextAll);
    setSelectedTable(trimmed);
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, nextAll);
    } else {
      newItemsToAppend.forEach((item) => onSaveItem(item, false));
    }

    setNewTableNameInput('');
    setCloneFromCurrentTable(false);
    setIsAddTableModalOpen(false);
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 2500);
  };

  // Xóa toàn bộ dữ liệu của 1 bảng / tủ trong ngày
  const handleDeleteCurrentTable = (tableToDelete: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu của bảng/tủ "${tableToDelete}" ngày ${selectedDate} không?`)) {
      return;
    }
    const nextAll = localItems.filter(
      (i) => !(i.dateStr === selectedDate && (i.tableName || DEFAULT_TABLE_NAME) === tableToDelete)
    );
    setLocalItems(nextAll);
    const remainingTables = existingTablesForDate.filter((t) => t !== tableToDelete);
    setSelectedTable(remainingTables[0] || DEFAULT_TABLE_NAME);
    if (onSaveDailyTable) {
      onSaveDailyTable(selectedDate, nextAll);
    }
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 2500);
  };

  // Khi click hoặc chạm vào bất kỳ ô số liệu nào, tự động đưa con trỏ về số sau cùng để dễ chỉnh sửa
  const handleFocusToEnd = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const len = el.value.length;
    setTimeout(() => {
      try {
        el.setSelectionRange(len, len);
      } catch {
        // Bỏ qua với các trường hợp không hỗ trợ selection
      }
    }, 20);
  };

  // Khi rời ô (onBlur), chuẩn hóa các số (loại bỏ dấu chấm ở cuối nếu đang gõ dở) và lưu ngầm
  const handleCellBlur = (id: string) => {
    setLocalItems((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const cleanNumber = (val?: string) => {
          if (val === undefined || val === null) return val;
          const trimmed = String(val).replace(/\.+$/, '');
          return trimmed === '' ? '0' : trimmed;
        };
        const updatedRow = {
          ...r,
          importQty: cleanNumber(r.importQty),
          wasteQty: cleanNumber(r.wasteQty),
          stockQty: cleanNumber(r.stockQty) || '0',
        };
        onSaveItem(updatedRow, true);
        return updatedRow;
      })
    );
  };

  // Đếm số lượng mặt hàng cần đặt (Tồn <= Ngưỡng Đặt) trên toàn bộ các tủ hôm nay
  const lowStockCount = useMemo(() => {
    let count = 0;
    allRowsForSelectedDate.forEach((item) => {
      const threshold = item.minThreshold ?? 3;
      const currentStock = parseFloat(item.stockQty) || 0;
      if (currentStock <= threshold) {
        count++;
      }
    });
    return count;
  }, [allRowsForSelectedDate]);

  // Đồng bộ số lượng hàng cần đặt theo thời gian thực ra App / HeaderNav
  useEffect(() => {
    onLowStockCountChange?.(lowStockCount);
  }, [lowStockCount, onLowStockCountChange]);

  // Lọc bảng theo tìm kiếm (trên bảng/tủ đang chọn)
  const filteredRows = rowsForSelectedDateAndTable
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
      rowsForSelectedDateAndTable.forEach((row) => onSaveItem(row, true));
    }
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 2500);
  };

  // Thêm mặt hàng mới (Admin) vào bảng/tủ đang chọn
  const handleAddNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newItemName.trim()) return;

    const exists = rowsForSelectedDateAndTable.some(
      (i) => i.itemName.toLowerCase() === newItemName.trim().toLowerCase()
    );
    if (exists) {
      alert(`Mặt hàng này đã có trong bảng "${selectedTable}" ngày hôm nay!`);
      return;
    }

    const initStockNum = parseFloat(newItemInitialStock) || 0;
    const newRow: InventoryCheckItem = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      stt: newItemStt,
      dateStr: selectedDate,
      tableName: selectedTable,
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

  // Xuất file text Bảng Tồn Kho (Hủy trước Tồn)
  const exportInventoryToText = () => {
    let content = `BẢNG TỒN KHO NGÀY ${selectedDate} - ${selectedTable}\n`;
    content += `(Công thức: Tồn = Nhập + Tồn Trước - Hủy • Ưu tiên nhập tay)\n\n`;
    content += `STT | Tên Mặt Hàng        | Tồn Trước | Nhập | Hủy | Tồn | Đơn Vị\n`;
    content += `----+---------------------+-----------+------+-----+-----+-------\n`;

    filteredRows.forEach((item) => {
      const prev = getPreviousDayStock(selectedDate, item.itemName, selectedTable);
      const imp = item.importQty || '0';
      const waste = item.wasteQty || '0';
      const stock = item.stockQty || String(prev);
      const sttStr = String(item.stt || 1).padEnd(3);
      const nameStr = item.itemName.padEnd(20);
      const prevStr = String(prev).padEnd(9);
      const impStr = String(imp).padEnd(4);
      const wasteStr = String(waste).padEnd(3);
      const stockStr = String(stock).padEnd(4);
      const unitStr = item.unit || 'kg';

      content += `${sttStr} | ${nameStr} | ${prevStr} | ${impStr} | ${wasteStr} | ${stockStr} | ${unitStr}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeDate = selectedDate.replace(/\//g, '-');
    const safeTable = selectedTable.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    a.download = `TonKho_${safeDate}_${safeTable}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Xuất file text Danh Sách Đặt Hàng (Gom từ toàn bộ tủ trong ngày)
  const exportOrderListToText = () => {
    let content = `DANH SÁCH ĐẶT HÀNG NGÀY ${selectedDate}\n\n`;
    content += `STT  | Tên Mặt Hàng                  | Số Lượng Đặt | Đơn Vị\n`;
    content += `-----+-------------------------------+--------------+-------\n`;

    let count = 0;
    // 1. Mặt hàng thiếu trong bảng tồn (tất cả các tủ)
    allRowsForSelectedDate.forEach((item) => {
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
          const cabinetTag = item.tableName && item.tableName !== DEFAULT_TABLE_NAME ? ` [${item.tableName}]` : '';
          const sttStr = String(item.stt || count).padEnd(4);
          const nameStr = `${item.itemName}${cabinetTag}`.slice(0, 29).padEnd(29);
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

  // Xuất file ảnh PNG Danh Sách Đặt Hàng (Đẹp mắt, trực quan để gửi thẳng qua Zalo)
  const exportOrderListToImage = () => {
    const selectedItemsList: Array<{
      stt: string;
      name: string;
      stock: string;
      qty: number;
      unit: string;
      isCustom?: boolean;
    }> = [];

    // 1. Mặt hàng thiếu trong bảng tồn (trên toàn bộ các tủ trong ngày)
    allRowsForSelectedDate.forEach((item) => {
      const threshold = item.minThreshold ?? 3;
      const currentStock = parseFloat(item.stockQty) || 0;
      if (currentStock <= threshold) {
        const keyId = `inv_${item.id}`;
        if (orderSelection[keyId] !== false) {
          const orderData = orderQuantities[keyId] || {
            qty: Math.max(1, threshold * 2 - currentStock),
            unit: item.unit || 'Kg',
          };
          const cabinetTag = item.tableName && item.tableName !== DEFAULT_TABLE_NAME ? ` [${item.tableName}]` : '';
          selectedItemsList.push({
            stt: String(item.stt || selectedItemsList.length + 1),
            name: `${item.itemName}${cabinetTag}`,
            stock: String(currentStock),
            qty: orderData.qty,
            unit: orderData.unit,
          });
        }
      }
    });

    // 2. Mặt hàng đặt cố định
    customOrders.forEach((customItem, idx) => {
      const keyId = `custom_${customItem.id}`;
      if (orderSelection[keyId] !== false) {
        const orderData = orderQuantities[keyId] || {
          qty: customItem.defaultQty,
          unit: customItem.unit,
        };
        selectedItemsList.push({
          stt: `CD-${idx + 1}`,
          name: customItem.name,
          stock: 'Cố định',
          qty: orderData.qty,
          unit: orderData.unit,
          isCustom: true,
        });
      }
    });

    if (selectedItemsList.length === 0) {
      alert('Vui lòng chọn ít nhất 1 mặt hàng để xuất ảnh đặt hàng!');
      return;
    }

    const scale = 2;
    const canvasWidth = 540;
    const headerHeight = 84;
    const tableHeaderHeight = 34;
    const rowHeight = 36;
    const footerHeight = 44;
    const totalHeight = headerHeight + tableHeaderHeight + selectedItemsList.length * rowHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * scale;
    canvas.height = totalHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    const safeRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
    };

    // 1. Nền tổng thể
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, totalHeight);

    // 2. Header Banner màu tối phong cách Bếp Pro
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasWidth, headerHeight);

    // Viền vàng hổ phách trang trí
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, headerHeight - 3, canvasWidth, 3);

    // Tiêu đề thương hiệu
    ctx.font = 'bold 10px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'left';
    ctx.fillText('KITCHEN LOG PRO • ĐƠN ĐẶT HÀNG BẾP', 16, 24);

    // Tiêu đề đơn hàng
    ctx.font = 'bold 17px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('DANH SÁCH CẦN ĐẶT HÀNG', 16, 48);

    // Thông tin ca / ngày / người lập
    ctx.font = '500 11px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const nowTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const creatorName = currentUser?.fullName || 'Bếp';
    ctx.fillText(`Ngày: ${selectedDate}  •  ${creatorName}  •  ${nowTimeStr}`, 16, 68);

    // Badge tổng số mặt hàng
    ctx.fillStyle = '#d97706';
    const badgeText = `${selectedItemsList.length} MẶT HÀNG`;
    ctx.font = 'bold 11px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const badgeWidth = ctx.measureText(badgeText).width + 14;
    ctx.beginPath();
    safeRoundRect(canvasWidth - badgeWidth - 16, 26, badgeWidth, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, canvasWidth - 16 - badgeWidth / 2, 42);

    // 3. Table Header
    const tableTop = headerHeight + 8;
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    safeRoundRect(12, tableTop, canvasWidth - 24, tableHeaderHeight, 6);
    ctx.fill();

    ctx.font = 'bold 11px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('STT', 32, tableTop + 21);
    ctx.textAlign = 'left';
    ctx.fillText('TÊN MẶT HÀNG', 62, tableTop + 21);
    ctx.textAlign = 'center';
    ctx.fillText('TỒN', 345, tableTop + 21);
    ctx.fillText('SỐ ĐẶT', 425, tableTop + 21);
    ctx.fillText('ĐƠN VỊ', 498, tableTop + 21);

    // 4. Rows
    let currentY = tableTop + tableHeaderHeight;
    selectedItemsList.forEach((row, idx) => {
      // Nền xen kẽ
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(12, currentY, canvasWidth - 24, rowHeight);

      // Đường kẻ mờ ngang
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, currentY + rowHeight);
      ctx.lineTo(canvasWidth - 12, currentY + rowHeight);
      ctx.stroke();

      // STT
      ctx.textAlign = 'center';
      ctx.font = row.isCustom ? 'bold 10px monospace' : 'bold 11px "Segoe UI", Roboto';
      ctx.fillStyle = row.isCustom ? '#4f46e5' : '#64748b';
      ctx.fillText(row.stt, 32, currentY + 22);

      // Tên hàng (ngắn gọn, cắt nếu dài quá)
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      ctx.fillStyle = '#0f172a';
      let displayName = row.name;
      if (ctx.measureText(displayName).width > 260) {
        while (ctx.measureText(displayName + '...').width > 260 && displayName.length > 0) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '...';
      }
      ctx.fillText(displayName, 62, currentY + 22);

      // Tồn hiện tại
      ctx.textAlign = 'center';
      ctx.font = '600 12px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      ctx.fillStyle = row.isCustom ? '#94a3b8' : '#e11d48';
      ctx.fillText(row.stock, 345, currentY + 22);

      // Khung nổi bật Số lượng đặt
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      safeRoundRect(398, currentY + 6, 54, 24, 6);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      ctx.fillStyle = '#b45309';
      ctx.fillText(String(row.qty), 425, currentY + 22);

      // Đơn vị
      ctx.textAlign = 'center';
      ctx.font = '600 11px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(row.unit, 498, currentY + 22);

      currentY += rowHeight;
    });

    // 5. Footer tóm tắt
    const footerTop = currentY + 6;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    safeRoundRect(12, footerTop, canvasWidth - 24, 32, 6);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = 'bold 11px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#166534';
    ctx.fillText(`✓ Xác nhận: ${selectedItemsList.length} mặt hàng cần nhập • Kitchen Log Pro`, 24, footerTop + 20);

    // Tải ảnh về
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeDate = selectedDate.replace(/\//g, '-');
      a.download = `DanhSachDatHang_${safeDate}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
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

            {/* Nút Phục Hồi Tồn Kho Khẩn Cấp nếu có bản sao lưu trên thiết bị */}
            {onRestoreEmergencyInventory && (
              <button
                type="button"
                onClick={onRestoreEmergencyInventory}
                className="h-8 px-2.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition flex items-center gap-1.5 shrink-0"
                title="Khôi phục lại dữ liệu tồn kho từ bản lưu khẩn cấp trên máy"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                <span>Phục Hồi Tồn</span>
              </button>
            )}

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

      {/* Thanh chọn Bảng / Tủ Lưu Kiểm Tồn trong ngày */}
      <div className="bg-white rounded-2xl shadow-xs border border-zinc-200 p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 shrink-0 mr-1 flex items-center gap-1">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Khu Vực Tủ:</span>
          </span>

          {existingTablesForDate.map((tableName) => {
            const isActive = tableName === selectedTable;
            const count = localItems.filter(
              (i) => i.dateStr === selectedDate && (i.tableName || DEFAULT_TABLE_NAME) === tableName
            ).length;
            const lowStockCountInTable = localItems.filter((i) => {
              if (i.dateStr !== selectedDate || (i.tableName || DEFAULT_TABLE_NAME) !== tableName) return false;
              const s = parseFloat(i.stockQty);
              return !isNaN(s) && s <= (i.minThreshold ?? 3);
            }).length;

            return (
              <button
                key={tableName}
                type="button"
                onClick={() => setSelectedTable(tableName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs ${
                  isActive
                    ? 'bg-zinc-950 text-white ring-2 ring-amber-400 shadow-sm'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                }`}
              >
                <span>{tableName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-zinc-600'
                  }`}
                >
                  {count}
                </span>
                {lowStockCountInTable > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Có mặt hàng cần đặt" />
                )}
              </button>
            );
          })}

          {/* Nút + Thêm Bảng Tủ Mới */}
          <button
            type="button"
            onClick={() => {
              setNewTableNameInput('');
              setIsAddTableModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1 shrink-0 shadow-xs active:scale-95 transition"
            title="Thêm bảng kiểm tồn cho tủ khác trong ngày hôm nay"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Bảng Tủ Mới</span>
          </button>
        </div>

        {/* Nút Xóa Tủ hiện tại (Nếu có từ 2 tủ trở lên trong ngày) */}
        {existingTablesForDate.length > 1 && (
          <button
            type="button"
            onClick={() => handleDeleteCurrentTable(selectedTable)}
            className="self-end sm:self-auto text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 shrink-0 flex items-center gap-1 font-semibold transition"
            title={`Xóa riêng bảng ${selectedTable}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa Bảng Tủ Này</span>
          </button>
        )}
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white rounded-2xl shadow-xs border border-zinc-200 p-3 sm:p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[170px] max-w-xs">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm tên hàng hóa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 2 Chế độ bảng: Chỉ Xem vs Chỉnh Sửa */}
          <div className="inline-flex p-0.5 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setTableMode('view')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
                tableMode === 'view'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="Chế độ chỉ xem gọn nhẹ, hiển thị vừa vặn màn hình điện thoại"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-700" />
              <span>Chỉ Xem</span>
            </button>
            <button
              type="button"
              onClick={() => setTableMode('edit')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
                tableMode === 'edit'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="Chế độ chỉnh sửa số liệu trực tiếp"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Chỉnh Sửa</span>
            </button>
          </div>

          <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-50 text-zinc-600 text-[11px] font-mono border border-zinc-200">
            Công thức: <strong>Tồn = Nhập + Tồn Trước - Hủy</strong> (Ưu tiên nhập tay)
          </span>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                const maxStt = rowsForSelectedDateAndTable.length > 0 ? Math.max(...rowsForSelectedDateAndTable.map((i) => i.stt || 1)) + 1 : 1;
                setNewItemStt(maxStt);
                setIsAddItemModalOpen(true);
              }}
              className="h-8 px-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Hàng</span>
            </button>
          )}

          {isAdmin && rowsForSelectedDateAndTable.length > 0 && (
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
                <th className="py-2.5 px-1.5 w-14 text-center" title="Kéo thả hoặc bấm mũi tên để đổi thứ tự hàng">
                  Kéo / STT
                </th>
                <th className="py-2.5 px-2 min-w-[120px] sm:min-w-[170px]">Tên Hàng</th>
                <th className="py-2.5 px-1.5 w-14 sm:w-16 text-right">Trước</th>
                <th className="py-2.5 px-1.5 w-14 sm:w-16 text-right">Nhập</th>
                <th className="py-2.5 px-1.5 w-12 sm:w-14 text-right">Hủy</th>
                <th className="py-2.5 px-1.5 w-16 sm:w-20 text-right">Tồn</th>
                <th className="py-2.5 px-1 w-11 sm:w-12 text-center">ĐVT</th>
                <th className="py-2.5 px-1 w-12 text-center">Đặt</th>
                {isAdmin && <th className="py-2.5 px-1 w-14 text-center">Ngưỡng</th>}
                {isAdmin && <th className="py-2.5 px-1 w-10 text-center">Xóa</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 8} className="py-10 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-2.5">
                      <p className="text-zinc-400 text-xs">
                        Tủ <strong>&ldquo;{selectedTable}&rdquo;</strong> chưa có mặt hàng nào.
                      </p>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setIsAddItemModalOpen(true)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm mặt hàng mới vào tủ này</span>
                        </button>
                      )}
                    </div>
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
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedItemId(item.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', item.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedItemId && draggedItemId !== item.id) {
                          setDragOverItemId(item.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverItemId === item.id) setDragOverItemId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedItemId && draggedItemId !== item.id) {
                          moveInventoryItem(draggedItemId, item.id);
                        }
                        setDraggedItemId(null);
                        setDragOverItemId(null);
                      }}
                      className={`hover:bg-zinc-50/80 transition border-b border-zinc-100 ${
                        dragOverItemId === item.id ? 'ring-2 ring-emerald-500 bg-emerald-50/60' : ''
                      }`}
                    >
                      {/* Kéo / STT */}
                      <td className="py-2 px-1 text-center font-semibold text-zinc-500">
                        <div className="flex items-center justify-center gap-0.5">
                          <div
                            className="flex items-center text-zinc-400 hover:text-zinc-800 cursor-grab active:cursor-grabbing"
                            title="Kéo thả hoặc bấm mũi tên để đổi vị trí"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                            <div className="flex flex-col -space-y-1">
                              <button
                                type="button"
                                onClick={() => moveInventoryItemDelta(item.id, -1)}
                                title="Đưa lên trên"
                                className="p-0.5 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-900 transition"
                              >
                                <ChevronUp className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveInventoryItemDelta(item.id, 1)}
                                title="Đưa xuống dưới"
                                className="p-0.5 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-900 transition"
                              >
                                <ChevronDown className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                          {isAdmin && tableMode === 'edit' ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.stt !== undefined ? item.stt : idx + 1}
                              onFocus={handleFocusToEnd}
                              onChange={(e) => handleCellChange(item.id, 'stt', e.target.value)}
                              onBlur={() => handleCellBlur(item.id)}
                              className="w-8 text-center bg-zinc-100 border border-zinc-200 rounded py-0.5 font-bold outline-none text-xs"
                            />
                          ) : (
                            <span className="text-xs font-bold text-zinc-600">{item.stt || idx + 1}</span>
                          )}
                        </div>
                      </td>

                      {/* Tên Hàng */}
                      <td className="py-2 px-2 font-medium text-zinc-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isAdmin && tableMode === 'edit' ? (
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleCellChange(item.id, 'itemName', e.target.value)}
                              onBlur={() => handleCellBlur(item.id)}
                              className="font-bold text-zinc-900 bg-transparent border-b border-dashed border-zinc-300 focus:border-emerald-600 outline-none w-full py-0.5 text-xs"
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900 text-xs">{item.itemName}</span>
                          )}

                          {isLowStock && (
                            <span
                              title="Tồn dưới ngưỡng - Cần đặt hàng"
                              className="inline-flex items-center justify-center p-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200"
                            >
                              <Star className="w-3 h-3 fill-rose-600 text-rose-600" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tồn Hôm Trước */}
                      <td className="py-2 px-1.5 text-right font-semibold text-zinc-600 bg-zinc-50/50 text-xs">
                        {prevStock}
                      </td>

                      {/* Nhập Vào */}
                      <td className="py-2 px-1.5 text-right">
                        {tableMode === 'view' ? (
                          <span className="font-bold text-indigo-700 text-xs">{item.importQty || '0'}</span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.importQty !== undefined ? item.importQty : '0'}
                            onFocus={handleFocusToEnd}
                            onChange={(e) => handleCellChange(item.id, 'importQty', e.target.value)}
                            onBlur={() => handleCellBlur(item.id)}
                            className="w-12 sm:w-14 text-center sm:text-right bg-zinc-50 focus:bg-white border border-zinc-200 rounded px-1 py-0.5 font-bold text-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                          />
                        )}
                      </td>

                      {/* Hủy (Đưa lên trước Tồn) */}
                      <td className="py-2 px-1.5 text-right">
                        {tableMode === 'view' ? (
                          <span className="font-semibold text-rose-600 text-xs">{item.wasteQty || '0'}</span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.wasteQty !== undefined ? item.wasteQty : '0'}
                            onFocus={handleFocusToEnd}
                            onChange={(e) => handleCellChange(item.id, 'wasteQty', e.target.value)}
                            onBlur={() => handleCellBlur(item.id)}
                            className="w-11 sm:w-13 text-center sm:text-right bg-rose-50/60 focus:bg-white border border-rose-200 focus:border-rose-400 rounded px-1 py-0.5 font-semibold text-rose-700 outline-none text-xs"
                          />
                        )}
                      </td>

                      {/* Tồn Hiện Tại */}
                      <td className="py-2 px-1.5 text-right">
                        {tableMode === 'view' ? (
                          <div className="flex items-center justify-end">
                            <span className={`px-1.5 py-0.5 rounded font-extrabold text-xs ${
                              isLowStock ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {item.stockQty}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.stockQty !== undefined ? item.stockQty : '0'}
                              onFocus={handleFocusToEnd}
                              onChange={(e) => handleCellChange(item.id, 'stockQty', e.target.value)}
                              onBlur={() => handleCellBlur(item.id)}
                              className="w-12 sm:w-14 text-center sm:text-right bg-emerald-50 focus:bg-white border border-emerald-300 rounded px-1 py-0.5 font-bold text-emerald-800 outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                            />
                          </div>
                        )}
                      </td>

                      {/* Đơn Vị */}
                      <td className="py-2 px-1 text-center">
                        {tableMode === 'view' ? (
                          <span className="text-zinc-600 font-medium text-[11px]">{item.unit || 'kg'}</span>
                        ) : (
                          <select
                            value={item.unit || 'kg'}
                            onChange={(e) => handleCellChange(item.id, 'unit', e.target.value)}
                            onBlur={() => handleCellBlur(item.id)}
                            className="bg-zinc-50 border border-zinc-200 rounded px-1 py-0.5 text-xs outline-none"
                          >
                            {COMMON_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Đặt Hàng theo dòng */}
                      <td className="py-2 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickOrderItem(item)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/30 transition shadow-2xs active:scale-95"
                          title={`Đặt hàng cho ${item.itemName}`}
                        >
                          <ShoppingCart className="w-3 h-3 text-amber-600" />
                          <span className="hidden sm:inline">Đặt</span>
                        </button>
                      </td>

                      {/* Ngưỡng Đặt (Admin) */}
                      {isAdmin && (
                        <td className="py-2 px-1 text-center">
                          {tableMode === 'view' ? (
                            <span className="text-xs font-bold text-amber-800">{threshold}</span>
                          ) : (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={threshold !== undefined ? threshold : '3'}
                              onFocus={handleFocusToEnd}
                              onChange={(e) => handleCellChange(item.id, 'minThreshold', e.target.value)}
                              onBlur={() => handleCellBlur(item.id)}
                              className="w-11 sm:w-12 text-center bg-amber-50 border border-amber-200 rounded py-0.5 font-bold text-amber-900 outline-none text-xs"
                            />
                          )}
                        </td>
                      )}

                      {/* Thao Tác (Admin) */}
                      {isAdmin && (
                        <td className="py-2 px-1 text-center">
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
                          allRowsForSelectedDate.forEach((i) => {
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
                  {/* 1. Mặt hàng thiếu trong bảng tồn (trên toàn bộ các tủ) */}
                  {allRowsForSelectedDate
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.itemName}</span>
                              {item.tableName && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  {item.tableName}
                                </span>
                              )}
                            </div>
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
                Tổng cộng: {lowStockCount + customOrders.length} mặt hàng ({lowStockCount} hàng thiếu kho • {customOrders.length} hàng cố định)
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportOrderListToImage}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center gap-1.5 shadow-xs active:scale-95"
                  title="Xuất ảnh danh sách đặt hàng đẹp mắt để gửi Zalo"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Xuất Ảnh PNG (Gửi Zalo)</span>
                </button>
                <button
                  type="button"
                  onClick={exportOrderListToText}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition flex items-center gap-1.5 shadow-xs active:scale-95"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Xuất File Text</span>
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

      {/* Modal: Thêm Bảng Lưu Kiểm Tồn / Tủ Mới */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-amber-600" />
                <span>Thêm Bảng Kiểm Tồn / Tủ Mới</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTableModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTable} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-700 font-bold mb-1">
                  Tên Tủ / Bảng Kiểm Mới: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTableNameInput}
                  onChange={(e) => setNewTableNameInput(e.target.value)}
                  placeholder="Ví dụ: Tủ Đông Thịt Cá, Tủ Rau Củ, Tủ Mát 2..."
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-semibold text-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                  autoFocus
                />
              </div>

              {/* Gợi ý tủ phổ biến */}
              <div>
                <span className="block text-[11px] font-bold text-zinc-500 mb-1.5">
                  Gợi ý tên tủ phổ biến:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CABINET_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewTableNameInput(preset)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-100 hover:bg-amber-100 hover:text-amber-900 text-zinc-700 rounded-lg transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tùy chọn sao chép danh mục hàng */}
              {rowsForSelectedDateAndTable.length > 0 && (
                <label className="flex items-start gap-2.5 p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs font-medium text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cloneFromCurrentTable}
                    onChange={(e) => setCloneFromCurrentTable(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    Sao chép danh mục mặt hàng từ <strong>{selectedTable}</strong> sang tủ mới (số lượng tồn đặt về 0 để kiểm mới).
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddTableModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition shadow-xs active:scale-95"
                >
                  Tạo Bảng Tủ Mới
                </button>
              </div>
            </form>
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
              <div className="p-2 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                <span className="text-zinc-500 font-semibold">Tủ / Bảng Lưu Trữ:</span>
                <span className="font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200">
                  {selectedTable}
                </span>
              </div>
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
                    onFocus={handleFocusToEnd}
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
