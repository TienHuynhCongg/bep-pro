export type TaskCategory = 'Sơ chế' | 'Nấu nướng' | 'Vệ sinh' | 'Kiểm kê' | 'An toàn ATTP' | 'Khác';
export type TaskPriority = 'Thường' | 'Gấp' | 'Tối khẩn';
export type TaskScheduleType = 'daily' | 'urgent_today';

export interface KitchenTask {
  id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  taskType?: TaskScheduleType; // 'daily': tự reset sau 24h | 'urgent_today': trong ngày gấp
  completed: boolean;
  assignedShift?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  note?: string;
  completedAt?: string;
  completedTimestamp?: number; // Dùng để tính tự động reset sau 24h cho task daily
  completedBy?: string;
  completedById?: string;
  completedByRole?: string;
  createdBy?: string;
  createdByRole?: UserRole;
  createdAt?: string;
}

export interface AppNotificationItem {
  id: string;
  actorName: string;
  actorRole?: UserRole;
  actionText: string;
  targetText?: string;
  createdAtMs: number;
  type: 'urgent_assigned' | 'task_urgent' | 'task_assigned' | 'task_completed' | 'task_reset' | 'system';
}

// 1. Chức năng Lưu Công Thức (Recipe)
export interface RecipeIngredient {
  id: string;
  name: string;     // Tên nguyên liệu (tự ghi)
  quantity: string; // Số lượng (chỉ được ghi số)
  unit: string;     // Định lượng (ml, g, kg, muỗng...)
}

export interface KitchenRecipe {
  id: string;
  dishName: string; // Tên món ăn ở trên cùng
  ingredients: RecipeIngredient[];
  instructions?: string; // Cách làm / Các bước chế biến món
  note?: string;
  createdBy?: string;
  updatedAt: string;
}

// 2. Chức năng Lưu Số Lượng Tồn Kiểm (Inventory Check)
export interface InventoryCheckItem {
  id: string;
  stt?: number;
  dateStr: string;       // Cột: Ngày
  itemName: string;      // Cột: Tên nguyên liệu / hàng hóa
  tableName?: string;    // Tên Bảng / Tủ lưu trữ (VD: "Tủ Mát Chính", "Tủ Đông", "Tủ Rau"...)
  prevStock?: string;    // Tồn hôm trước
  importQty?: string;    // Nhập vào
  stockQty: string;      // Số lượng Tồn (chỉ ghi số)
  wasteQty: string;      // Số lượng Hủy (chỉ ghi số)
  minThreshold?: number; // Ngưỡng đặt hàng (báo cần đặt khi tồn <= ngưỡng)
  unit: string;          // Đơn vị (kg, g, ml, phần, bịch...)
  statusType?: 'ton' | 'huy' | 'both'; // Tồn / Hủy / Cả hai
  isManualStock?: boolean;             // Người dùng đã nhập tay tồn kho (ưu tiên hơn công thức)
  createdBy?: string;
  createdAt?: string;
}

export interface CustomOrderItem {
  id: string;
  name: string;
  defaultQty: number;
  unit: string;
}

export type DeleteTargetType = 'log_single' | 'log_all' | 'staff' | 'nav_item';

export interface DeleteRequest {
  id: string;
  targetType: DeleteTargetType;
  targetId?: string;
  targetLabel: string;
  requestedBy: string;
  requestedByRole: UserRole;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'date' | 'time';

export interface DynamicField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  width?: 'full' | 'half';
}

export interface ShiftLogField {
  id: string;
  label: string;
  value: string;
}

export interface ShiftLog {
  id: string;
  timestamp: string;
  dateStr: string;
  shiftName: string;
  staffName: string;
  tasks: KitchenTask[];
  completedCount: number;
  totalCount: number;
  fields: ShiftLogField[];
}

export type NavItemType =
  | 'checklist'
  | 'recipes'
  | 'inventory'
  | 'history'
  | 'analytics'
  | 'chef_tasks'
  | 'admin'
  | 'staff'
  | 'custom';

export interface NavItem {
  id: string;
  label: string;
  iconName: string;
  targetType: NavItemType;
  visible: boolean;
  colorTheme?: 'amber' | 'emerald' | 'blue' | 'rose' | 'purple' | 'indigo';
  customTitle?: string;
  customContent?: string;
  allowedRoles?: UserRole[];
}

export interface AppConfig {
  appTitle: string;
  appSubtitle: string;
  brandIcon: string;
  hourlyReminderEnabled?: boolean;
  hourlyReminderStartHour?: number;
  hourlyReminderEndHour?: number;
  emailBackupEnabled?: boolean;
  emailBackupRecipient?: string;
  emailBackupSenderEmail?: string;
  emailBackupSenderPassword?: string;
  emailBackupFrequency?: 'weekly' | 'daily';
  lastEmailBackupAt?: number;
}

export type UserRole = 'admin' | 'manager' | 'staff';

export interface StaffUser {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  station: string;
  phone?: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
  avatarColor?: string;
}

export const canRoleAccessTab = (
  role: UserRole | undefined,
  targetType: NavItemType,
  item?: NavItem
): boolean => {
  // Admin has full access to all tabs
  if (role === 'admin') return true;

  // If item has explicit allowedRoles configured
  if (item?.allowedRoles && item.allowedRoles.length > 0) {
    return !!role && item.allowedRoles.includes(role);
  }

  // Manager (Trưởng Ca)
  if (role === 'manager') {
    return (
      targetType === 'checklist' ||
      targetType === 'recipes' ||
      targetType === 'inventory' ||
      targetType === 'history' ||
      targetType === 'analytics' ||
      targetType === 'chef_tasks' ||
      targetType === 'custom'
    );
  }

  // Staff (Nhân Viên Bếp): checklist, recipes, inventory, history
  return (
    targetType === 'checklist' ||
    targetType === 'recipes' ||
    targetType === 'inventory' ||
    targetType === 'history'
  );
};
