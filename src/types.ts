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

export type NavItemType = 'checklist' | 'history' | 'analytics' | 'chef_tasks' | 'admin' | 'staff' | 'custom';

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

  // Manager (Trưởng Ca): checklist, history, analytics, chef_tasks, and custom tabs
  if (role === 'manager') {
    return (
      targetType === 'checklist' ||
      targetType === 'history' ||
      targetType === 'analytics' ||
      targetType === 'chef_tasks' ||
      targetType === 'custom'
    );
  }

  // Staff (Nhân Viên Bếp) or guest: ONLY checklist and history
  return targetType === 'checklist' || targetType === 'history';
};

