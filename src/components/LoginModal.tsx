import React, { useState } from 'react';
import { StaffUser, UserRole } from '../types.ts';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ChefHat,
  X,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  UserPlus,
  Check,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffUser[];
  currentUser: StaffUser | null;
  onLogin: (user: StaffUser) => void;
  onLogout: () => void;
  onRegisterStaff: (newStaff: Omit<StaffUser, 'id'>, autoLogin?: boolean) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  staffList,
  currentUser,
  onLogin,
  onLogout,
  onRegisterStaff,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regStation, setRegStation] = useState('Khu Bếp Nóng & Ra Món');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('staff');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  if (!isOpen && currentUser) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const found = staffList.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        (u.password ? u.password === password : true)
    );

    if (!found) {
      setErrorMessage('Tên đăng nhập hoặc mật khẩu không chính xác!');
      return;
    }

    if (found.status === 'inactive') {
      setErrorMessage('Tài khoản nhân sự này hiện đang bị khóa tạm thời. Vui lòng liên hệ Bếp Trưởng.');
      return;
    }

    onLogin(found);
    setUsername('');
    setPassword('');
    onClose();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regFullName.trim() || !regUsername.trim() || !regPassword) {
      setRegError('Vui lòng điền đầy đủ các thông tin bắt buộc!');
      return;
    }

    // Check username exists
    if (staffList.some((u) => u.username.toLowerCase() === regUsername.trim().toLowerCase())) {
      setRegError('Tên đăng nhập này đã tồn tại! Vui lòng chọn username khác.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    const colors = [
      'bg-amber-600',
      'bg-emerald-600',
      'bg-blue-600',
      'bg-purple-600',
      'bg-rose-600',
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newStaffData: Omit<StaffUser, 'id'> = {
      fullName: regFullName.trim(),
      username: regUsername.trim().toLowerCase(),
      password: regPassword,
      role: currentUser?.role === 'admin' ? regRole : 'staff',
      station: regStation,
      phone: regPhone.trim(),
      status: 'active',
      avatarColor: randomColor,
      lastLogin: new Date().toLocaleString('vi-VN'),
    };

    // Thêm nhân sự mới và tự động đăng nhập nguyên khối (không bị ghi đè state)
    onRegisterStaff(newStaffData, true);
    setRegSuccess('Đăng ký tài khoản thành công!');

    setTimeout(() => {
      onClose();
      setMode('login');
      setRegFullName('');
      setRegUsername('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegPhone('');
      setRegSuccess('');
    }, 500);
  };

  const handleQuickSelect = (user: StaffUser) => {
    if (currentUser?.role === 'admin') {
      onLogin(user);
      onClose();
    } else {
      setUsername(user.username);
      setErrorMessage('');
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3.5 pt-safe-top pb-safe-bottom animate-fadeIn ${
        currentUser ? 'bg-black/65 backdrop-blur-xs' : 'bg-zinc-950'
      }`}
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[84dvh]">
        {/* Header */}
        <div className="bg-zinc-950 text-white p-5 relative border-b border-zinc-800">
          {currentUser && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 text-amber-400">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                {mode === 'login' ? 'Đăng Nhập Ca Bếp' : 'Đăng Ký Tài Khoản Mới'}
              </h3>
              <p className="text-xs text-zinc-400">
                {!currentUser
                  ? 'Bắt buộc đăng nhập để truy cập hệ thống bếp'
                  : mode === 'login'
                  ? 'Đổi tài khoản nhân sự hoặc đăng xuất ca'
                  : 'Tạo tài khoản nhân sự mới cho ca bếp'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl mt-4 border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setRegError('');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Đăng Ký Mới</span>
            </button>
          </div>
        </div>

        {/* Current User State if logged in */}
        {currentUser && (
          <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                  currentUser.avatarColor || 'bg-zinc-900'
                }`}
              >
                {currentUser.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-900">{currentUser.fullName}</div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                  <span>Vai trò:</span>
                  <code className="font-mono font-bold text-zinc-900 bg-zinc-200/70 px-1.5 py-0.2 rounded">
                    @{currentUser.role}
                  </code>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onLogout();
              }}
              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
            >
              Đăng xuất
            </button>
          </div>
        )}

        {/* ===================== MODE 1: LOGIN ===================== */}
        {mode === 'login' && (
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleLoginSubmit} className="p-5 space-y-3.5">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Tên Đăng Nhập (Username)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: admin, truongca, nv_bep, thc..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Mật Khẩu (Password)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Nhập mật khẩu..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-zinc-400 hover:text-zinc-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-bold rounded-xl text-sm shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>Đăng Nhập Ca Làm Việc</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs text-zinc-700 hover:text-zinc-950 font-bold hover:underline"
                >
                  Chưa có tài khoản? Bấm vào đây để Đăng Ký Mới
                </button>
              </div>
            </form>

            {/* Danh sách toàn bộ tài khoản nhân sự đã đăng ký (Hiển thị đầy đủ cả người đăng ký mới) */}
            <div className="bg-zinc-50 p-4 border-t border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {currentUser?.role === 'admin'
                    ? `Chuyển nhanh tài khoản (${staffList.length} nhân sự):`
                    : `Danh sách nhân sự đã đăng ký (${staffList.length}):`}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {currentUser?.role === 'admin' ? 'Chạm để đổi' : 'Chạm để điền tên'}
                </span>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                {staffList.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickSelect(u)}
                      className={`w-full p-2 rounded-xl text-left flex items-center justify-between text-xs transition border ${
                        isCurrent
                          ? 'bg-amber-50 border-amber-300'
                          : 'bg-white hover:bg-zinc-100 border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                            u.avatarColor || 'bg-zinc-800'
                          }`}
                        >
                          {u.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-zinc-900 truncate block sm:inline">
                            {u.fullName}
                          </span>
                          <span className="text-zinc-400 text-[10px] sm:ml-1.5 font-mono">
                            (@{u.username})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Đang dùng
                          </span>
                        )}
                        <code
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                            u.role === 'admin'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : u.role === 'manager'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-blue-100 text-blue-900 border-blue-300'
                          }`}
                        >
                          @{u.role}
                        </code>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODE 2: REGISTER ===================== */}
        {mode === 'register' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            {regError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Họ Và Tên Đầy Đủ <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="VD: Trần Đình Khang, Tiến..."
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Tên Đăng Nhập (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: thc, nvbep_khang..."
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full p-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                    Mật Khẩu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mật khẩu..."
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full p-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                    Nhập Lại Mật Khẩu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Xác nhận..."
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full p-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
              </div>

              {currentUser?.role === 'admin' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                    Vai Trò (@code)
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full p-2 text-xs font-mono font-bold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                  >
                    <option value="staff">@staff</option>
                    <option value="manager">@manager</option>
                    <option value="admin">@admin</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-bold rounded-xl text-sm shadow-sm transition flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Hoàn Tất Đăng Ký Tài Khoản</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-zinc-500 hover:text-zinc-800 font-semibold"
                >
                  Đã có tài khoản? Quay lại Đăng Nhập
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
