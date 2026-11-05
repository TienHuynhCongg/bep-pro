import {
  AppConfig,
  DynamicField,
  KitchenTask,
  NavItem,
  ShiftLog,
  KitchenRecipe,
  InventoryCheckItem,
  CustomOrderItem,
} from './types.ts';

export const DEFAULT_APP_CONFIG: AppConfig = {
  appTitle: 'KITCHEN LOG PRO',
  appSubtitle: 'Quản Lý Công Việc Bếp Núc Hàng Ngày',
  brandIcon: 'Utensils',
  hourlyReminderEnabled: true,
  hourlyReminderStartHour: 8,
  hourlyReminderEndHour: 22,
};

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  {
    id: 'nav-checklist',
    label: 'Checklist',
    iconName: 'ListChecks',
    targetType: 'checklist',
    visible: true,
    colorTheme: 'amber',
  },
  {
    id: 'nav-recipes',
    label: 'Công Thức',
    iconName: 'BookOpen',
    targetType: 'recipes',
    visible: true,
    colorTheme: 'amber',
  },
  {
    id: 'nav-inventory',
    label: 'Tồn Kiểm',
    iconName: 'PackageCheck',
    targetType: 'inventory',
    visible: true,
    colorTheme: 'emerald',
  },
  {
    id: 'nav-history',
    label: 'Lịch Sử',
    iconName: 'Archive',
    targetType: 'history',
    visible: true,
    colorTheme: 'emerald',
  },
  {
    id: 'nav-analytics',
    label: 'Thống Kê',
    iconName: 'BarChart3',
    targetType: 'analytics',
    visible: true,
    colorTheme: 'blue',
  },
  {
    id: 'nav-chef-tasks',
    label: 'Giao Việc',
    iconName: 'ChefHat',
    targetType: 'chef_tasks',
    visible: true,
    colorTheme: 'amber',
  },
  {
    id: 'nav-staff',
    label: 'Nhân Sự',
    iconName: 'UserCheck',
    targetType: 'staff',
    visible: true,
    colorTheme: 'purple',
  },
  {
    id: 'nav-admin',
    label: 'Cấu Hình',
    iconName: 'Sliders',
    targetType: 'admin',
    visible: true,
    colorTheme: 'amber',
  },
];

export const DEFAULT_RECIPES: KitchenRecipe[] = [];

export const DEFAULT_INVENTORY: InventoryCheckItem[] = [];

export const DEFAULT_CUSTOM_ORDERS: CustomOrderItem[] = [
  { id: 'custom_1', name: 'Nước rửa chén', defaultQty: 2, unit: 'Can' },
  { id: 'custom_2', name: 'Khăn giấy rút', defaultQty: 5, unit: 'Thùng' },
  { id: 'custom_3', name: 'Màng bọc thực phẩm', defaultQty: 3, unit: 'Cuộn' },
];

export const DEFAULT_STAFF_USERS = [
  {
    id: 'staff-1',
    username: 'admin',
    password: '123',
    fullName: 'Chef Hoàng Nam (Bếp Trưởng)',
    role: 'admin' as const,
    station: 'Toàn Bếp & Giám Sát',
    phone: '0901234567',
    status: 'active' as const,
    lastLogin: '19/10/2026, 08:30:00',
    avatarColor: 'bg-amber-600',
  },
  {
    id: 'staff-2',
    username: 'truongca',
    password: '123',
    fullName: 'Trần Văn Hưng (Trưởng Ca)',
    role: 'manager' as const,
    station: 'Khu Bếp Nóng & Ra Món',
    phone: '0912345678',
    status: 'active' as const,
    lastLogin: '18/10/2026, 14:00:00',
    avatarColor: 'bg-emerald-600',
  },
  {
    id: 'staff-3',
    username: 'nv_bep',
    password: '123',
    fullName: 'Lê Minh Tuấn (Phụ Bếp)',
    role: 'staff' as const,
    station: 'Khu Sơ Chế & Rửa',
    phone: '0987654321',
    status: 'active' as const,
    lastLogin: '17/10/2026, 06:15:00',
    avatarColor: 'bg-blue-600',
  },
];

export const DEFAULT_TASKS: KitchenTask[] = [];

export function filterOutDefaultTasks(taskList: KitchenTask[]): KitchenTask[] {
  if (!Array.isArray(taskList)) return [];
  const defaultIds = new Set(['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6']);
  return taskList.filter((t) => {
    if (!t) return false;
    if (defaultIds.has(String(t.id))) return false;
    const title = String(t.title || '').trim().toLowerCase();
    if (
      title.includes('nhiệt độ tủ mát') ||
      title.includes('sơ chế rau củ, củ quả và cá thịt') ||
      title.includes('nấu nước dùng chính & chia định lượng') ||
      title.includes('bọc màng thực phẩm & dán nhãn') ||
      title.includes('bề mặt bếp gas, bếp từ, vỉ nướng') ||
      title.includes('khử khuẩn sàn bếp, nghiệm thu thùng rác')
    ) {
      return false;
    }
    return true;
  });
}

export const DEFAULT_SCHEMA: DynamicField[] = [
  {
    id: 'field-1',
    label: 'Tên Trực Ca / Đầu Bếp Phụ Trách',
    type: 'text',
    required: true,
    placeholder: 'Ví dụ: Nguyễn Văn Bếp, Chef Tuấn...',
    width: 'half',
  },
  {
    id: 'field-2',
    label: 'Ca Làm Việc',
    type: 'select',
    required: true,
    options: ['Ca Sáng (06:00 - 14:00)', 'Ca Chiều (14:00 - 22:00)', 'Ca Đêm (22:00 - 06:00)', 'Ca Gãy (10:00 - 14:00 & 17:00 - 21:00)'],
    width: 'half',
  },
  {
    id: 'field-3',
    label: 'Nhiệt Độ Tủ Mát / Tủ Đông (°C)',
    type: 'text',
    required: false,
    placeholder: 'Tủ mát: 3.5°C, Tủ đông: -19°C',
    width: 'half',
  },
  {
    id: 'field-4',
    label: 'Đánh Giá Vệ Sinh ATTP',
    type: 'select',
    required: false,
    options: ['Đạt chuẩn 100% (Sạch sẽ, gọn gàng)', 'Đạt loại khá (Có lưu ý nhỏ)', 'Cần nhắc nhở vệ sinh bổ sung'],
    width: 'half',
  },
  {
    id: 'field-5',
    label: 'Ghi Chú Phát Sinh / Nguyên Liệu Cần Báo Mua',
    type: 'textarea',
    required: false,
    placeholder: 'Báo cáo hao hụt, sự cố thiết bị bếp, hoặc nguyên vật liệu cần nhập gấp ngày mai...',
    width: 'full',
  },
];

export const INITIAL_SAMPLE_LOGS: ShiftLog[] = [];
