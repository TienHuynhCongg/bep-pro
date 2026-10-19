import React, { useState } from 'react';
import { StaffUser, UserRole, ShiftLog } from '../types.ts';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Key,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Lock,
  Phone,
  Briefcase,
  LogIn,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface StaffManagementViewProps {
  staffList: StaffUser[];
  currentUser: StaffUser | null;
  onAddStaff: (newStaff: Omit<StaffUser, 'id'>) => void;
  onUpdateStaff: (updated: StaffUser) => void;
  onDeleteStaff: (id: string) => void;
  onSwitchUser: (user: StaffUser) => void;
  logs: ShiftLog[];
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  staffList,
  currentUser,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onSwitchUser,
  logs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Form states for new staff
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [role, setRole] = useState<UserRole>('staff');
  const [station, setStation] = useState('Khu Bếp Nóng & Ra Món');
  const [phone, setPhone] = useState('');

  // Form states for edit staff
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('staff');
  const [editStation, setEditStation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const colors = [
    'bg-amber-600',
    'bg-emerald-600',
    'bg-blue-600',
    'bg-rose-600',
    'bg-purple-600',
    'bg-indigo-600',
  ];

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim()) return;

    // Check duplicate username
    if (staffList.some((s) => s.username.toLowerCase() === username.trim().toLowerCase())) {
      alert('Tên đăng nhập này đã tồn tại! Vui lòng chọn tên đăng nhập khác.');
      return;
    }

    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    onAddStaff({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      password: password || '123',
      role,
      station,
      phone: phone.trim(),
      status: 'active',
      avatarColor: randomColor,
    });

    setFullName('');
    setUsername('');
    setPassword('123');
    setPhone('');
    setShowAddModal(false);
  };

  const startEdit = (staff: StaffUser) => {
    setEditingStaffId(staff.id);
    setEditFullName(staff.fullName);
    setEditRole(staff.role);
    setEditStation(staff.station);
    setEditPhone(staff.phone || '');
    setEditPassword(staff.password || '');
  };

  const saveEdit = (staff: StaffUser) => {
    if (!editFullName.trim()) return;
    onUpdateStaff({
      ...staff,
      fullName: editFullName.trim(),
      role: isAdmin ? editRole : staff.role,
      station: editStation,
      phone: editPhone.trim(),
      password: editPassword || staff.password,
    });
    setEditingStaffId(null);
  };

  const toggleStatus = (staff: StaffUser) => {
    onUpdateStaff({
      ...staff,
      status: staff.status === 'active' ? 'inactive' : 'active',
    });
  };

  const isAdmin = currentUser?.role === 'admin';

  // If admin: shows all staff to manage and edit roles. If non-admin: only shows that person's own profile ("chỉ xổ giao diện của người đó thôi")
  const displayedStaffList = isAdmin
    ? staffList
    : staffList.filter((s) => s.id === currentUser?.id);

  const filteredStaff = displayedStaffList.filter((s) => {
    const matchSearch =
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.station.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = roleFilter === 'all' ? true : s.role === roleFilter;

    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 mb-6 border-b border-stone-100 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                {isAdmin ? 'Quản Trị Nhân Sự & Phân Quyền Bếp' : 'Hồ Sơ Nhân Sự Cá Nhân'}
              </span>
              <span className="text-xs text-stone-500 font-medium">
                {isAdmin ? `${staffList.length} nhân sự đăng ký` : 'Giao diện cá nhân'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600" />
              {isAdmin ? 'Giao Diện Quản Lý Nhân Sự Ca Bếp' : 'Thông Tin Cá Nhân & Ca Trực'}
            </h2>
            <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
              {isAdmin
                ? 'Bếp Trưởng có toàn quyền chỉnh sửa vai trò (Bếp Trưởng / Trưởng Ca / Nhân Viên), thêm bớt tài khoản và phân công khu vực.'
                : 'Bạn đang đăng nhập tài khoản cá nhân. Quyền chỉnh sửa vai trò thuộc về Bếp Trưởng (Admin).'}
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-700/30 transition flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm Nhân Sự Mới</span>
            </button>
          )}
        </div>

        {/* Current Active User Banner */}
        {currentUser && (
          <div className="mb-6 bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950 text-white p-4 sm:p-5 rounded-2xl border border-amber-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-md border border-white/20 ${
                  currentUser.avatarColor || 'bg-amber-600'
                }`}
              >
                {currentUser.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-300 font-medium">Tài khoản đang đăng nhập:</span>
                  <code className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 font-mono font-bold border border-amber-400/30">
                    @{currentUser.role}
                  </code>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {currentUser.fullName} <span className="text-xs font-normal text-stone-300 font-mono">(@{currentUser.username})</span>
                </h3>
              </div>
            </div>

            <div className="text-xs text-stone-300 bg-white/10 px-3 py-2 rounded-xl border border-white/10 self-stretch sm:self-auto text-center sm:text-right">
              Mọi báo cáo ca nộp sẽ tự động gắn với tên bạn
            </div>
          </div>
        )}

        {/* Filters and Search (Admin Only) */}
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Tìm theo họ tên hoặc username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'admin', label: '@admin' },
                { id: 'manager', label: '@manager' },
                { id: 'staff', label: '@staff' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  onClick={() => setRoleFilter(rf.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap transition ${
                    roleFilter === rf.id
                      ? 'bg-purple-800 text-white shadow-sm'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Staff List Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => {
            const isEditing = editingStaffId === staff.id;
            const isSelf = currentUser?.id === staff.id;

            // Calculate shift logs completed by this staff member
            const staffLogs = logs.filter(
              (l) => l.staffName.toLowerCase() === staff.fullName.toLowerCase()
            );
            const shiftsCount = staffLogs.length;

            return (
              <div
                key={staff.id}
                className={`rounded-2xl border transition p-5 flex flex-col justify-between ${
                  isSelf
                    ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400/40'
                    : staff.status === 'active'
                    ? 'bg-white hover:bg-stone-50/50 border-stone-200 shadow-xs'
                    : 'bg-stone-100/70 border-stone-200 opacity-60'
                }`}
              >
                {isEditing ? (
                  /* Edit inline form */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 uppercase">Sửa thông tin:</span>
                      <button
                        onClick={() => setEditingStaffId(null)}
                        className="text-stone-400 hover:text-stone-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">Họ & Tên</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full p-2 text-xs bg-stone-50 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className={isAdmin ? 'grid grid-cols-2 gap-2' : ''}>
                      {isAdmin && (
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">
                            Vai Trò (@code)
                          </label>
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="w-full p-2 text-xs font-mono font-bold border rounded-lg outline-none bg-stone-50 border-stone-300 text-purple-900 focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="admin">@admin</option>
                            <option value="manager">@manager</option>
                            <option value="staff">@staff</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">Mật Khẩu Mới</label>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="w-full p-2 text-xs bg-stone-50 border border-stone-300 rounded-lg outline-none"
                          placeholder="Mật khẩu..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-2">
                      <button
                        onClick={() => setEditingStaffId(null)}
                        className="px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-200 rounded"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => saveEdit(staff)}
                        className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold"
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Card Body */
                  <div className="space-y-4">
                    {/* Top Row: Avatar & Roles */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-md ${
                            staff.avatarColor || 'bg-amber-600'
                          }`}
                        >
                          {staff.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-extrabold text-stone-900 text-sm leading-tight">
                            {staff.fullName}
                          </div>
                          <div className="text-xs text-stone-400 font-mono">@{staff.username}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <code
                          className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md ${
                            staff.role === 'admin'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : staff.role === 'manager'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}
                        >
                          @{staff.role}
                        </code>

                        <span
                          className={`text-[9px] font-semibold flex items-center gap-1 ${
                            staff.status === 'active' ? 'text-emerald-600' : 'text-stone-400'
                          }`}
                        >
                          {staff.status === 'active' ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Hoạt động
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" /> Tạm khóa
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="bg-stone-50/80 p-3 rounded-xl border border-stone-100 text-xs text-stone-600">
                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <span>Đã nộp: <strong className="text-stone-700">{shiftsCount} ca</strong></span>
                        <span>Pass: <code className="bg-white px-1 rounded border border-stone-200 text-stone-600">{staff.password || '123'}</code></span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 gap-1">
                      {/* Switch to this user */}
                      <button
                        onClick={() => onSwitchUser(staff)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          isSelf
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-stone-100 hover:bg-purple-50 text-stone-700 hover:text-purple-800 border border-stone-200'
                        }`}
                        title="Đăng nhập ngay với tư cách tài khoản này"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{isSelf ? 'Đang dùng' : 'Đăng nhập'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <button
                            onClick={() => toggleStatus(staff)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg text-xs"
                            title={staff.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {staff.status === 'active' ? (
                              <Lock className="w-3.5 h-3.5 text-stone-500" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => startEdit(staff)}
                          className="p-1.5 text-stone-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg text-xs"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (staffList.length <= 1) {
                                alert('Hệ thống cần ít nhất 1 tài khoản nhân sự!');
                                return;
                              }
                              if (window.confirm(`Xóa nhân sự "${staff.fullName}" (@${staff.username}) khỏi danh sách?`)) {
                                onDeleteStaff(staff.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-900 to-stone-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600 rounded-xl text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-purple-100">Thêm Tài Khoản Nhân Sự Mới</h3>
                  <p className="text-xs text-purple-300">Cấp quyền và tạo thông tin đăng nhập ca bếp</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Họ Và Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn Bếp, Chef Lâm..."
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Tên Đăng Nhập (Username) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: cheflam, nvbep2..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Mật Khẩu Ban Đầu
                  </label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Vai Trò Phân Quyền (@code)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="staff">@staff</option>
                    <option value="manager">@manager</option>
                    <option value="admin">@admin</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Tạo Tài Khoản Nhân Sự</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
