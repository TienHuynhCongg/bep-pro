import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Share, PlusSquare, CheckCircle2, QrCode, Copy, Check, Globe, Server } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onTriggerInstall: () => Promise<void>;
  serverConnected: boolean;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerInstall,
  serverConnected,
}) => {
  const [activeOsTab, setActiveOsTab] = useState<'android' | 'ios'>('android');
  const [copied, setCopied] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
      const ua = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setActiveOsTab('ios');
      } else {
        setActiveOsTab('android');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(
    appUrl || 'http://localhost:3000'
  )}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden animate-fadeIn my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-stone-900 to-amber-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-2xl border border-amber-400/40">
              <Smartphone className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-50">
                Tải App Bếp Pro (iOS & Android)
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    serverConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                  }`}
                />
                <span className="text-[11px] text-amber-200/90 font-medium">
                  {serverConnected
                    ? 'Server Real-time đang đồng bộ trực tiếp'
                    : 'Chế độ Offline / Cục bộ'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* 1-Click Install Banner if supported by browser */}
          {deferredPrompt && (
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-100">
                  Thiết bị hỗ trợ cài đặt nhanh
                </div>
                <div className="text-sm font-bold mt-0.5">
                  Tải và cài đặt trực tiếp ra màn hình chính điện thoại
                </div>
              </div>
              <button
                onClick={onTriggerInstall}
                className="w-full sm:w-auto px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-black rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Cài Đặt Ngay</span>
              </button>
            </div>
          )}

          {/* OS Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200">
            <button
              type="button"
              onClick={() => setActiveOsTab('android')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeOsTab === 'android'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>Android (Samsung, Xiaomi, Oppo...)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveOsTab('ios')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeOsTab === 'ios'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>iOS (iPhone / iPad)</span>
            </button>
          </div>

          {/* Instructions by OS */}
          {activeOsTab === 'android' ? (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-extrabold uppercase text-amber-900">
                Cách tải App trên điện thoại Android:
              </div>

              <div className="space-y-2.5 text-xs text-stone-700">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    Mở đường link hệ thống bằng trình duyệt <strong>Chrome</strong> trên điện thoại Android.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    Nhấn nút <strong>&quot;Cài Đặt Ngay&quot;</strong> ở trên, hoặc chạm vào biểu tượng <strong>3 chấm (⋮)</strong> ở góc phải trên cùng của Chrome.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    Chọn <strong>&quot;Cài đặt ứng dụng&quot; (Install App)</strong> hoặc <strong>&quot;Thêm vào màn hình chính&quot;</strong>. App <strong>Bếp Pro</strong> sẽ được tải về máy như ứng dụng độc lập!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-4">
              {/* Cách 1: Tải file cấu hình App iOS trực tiếp (.mobileconfig) - 100% Free */}
              <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase text-amber-900">
                    Cách 1: Tải File Cài Đặt Trực Tiếp Cho iPhone (Free 100%)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Không dùng file APK của Android. iPhone có chuẩn bộ cài riêng (<strong>.mobileconfig</strong>) hoàn toàn miễn phí:
                </p>
                <a
                  href={`/api/ios-app.mobileconfig?url=${encodeURIComponent(appUrl || window.location.origin)}`}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Bộ Cài App Cho iOS (iPhone / iPad)</span>
                </a>
                <div className="text-[11px] text-stone-500 space-y-1 pt-1">
                  <div>• Bước 1: Bấm nút tải trên bằng Safari → Chọn <strong>&quot;Cho phép&quot; (Allow)</strong>.</div>
                  <div>• Bước 2: Mở <strong>Cài đặt (Settings)</strong> của iPhone → Bấm vào <strong>&quot;Đã tải về hồ sơ&quot; (Profile Downloaded)</strong> ngay đầu trang → Bấm <strong>Cài đặt (Install)</strong> là App hiện ra màn hình chính!</div>
                </div>
              </div>

              {/* Cách 2: Thêm trực tiếp từ Safari (Không cần vào Cài đặt) */}
              <div className="space-y-2.5 text-xs text-stone-700 pt-1">
                <div className="text-xs font-extrabold uppercase text-amber-900">
                  Cách 2: Cài nhanh 2 chạm ngay trên Safari (Free 100%):
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="flex items-center flex-wrap gap-1">
                    <span>Ở thanh dưới cùng trình duyệt <strong>Safari</strong>, bấm nút</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                      <Share className="w-3.5 h-3.5" /> Chia sẻ (Share)
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="flex items-center flex-wrap gap-1">
                    <span>Chọn</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-200 text-stone-900 font-bold">
                      <PlusSquare className="w-3.5 h-3.5" /> Thêm vào MH chính (Add to Home Screen)
                    </span>
                    <span>→ Bấm <strong>Thêm (Add)</strong>.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QR Code & Share Link for Kitchen Staff */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-2.5 rounded-2xl border border-amber-200 shadow-xs shrink-0">
              <img
                src={qrCodeUrl}
                alt="QR Code tải App Bếp Pro"
                className="w-32 h-32 rounded-lg"
              />
            </div>
            <div className="space-y-2 flex-1 text-center sm:text-left w-full">
              <div className="text-xs font-extrabold text-amber-950 flex items-center justify-center sm:justify-start gap-1.5">
                <QrCode className="w-4 h-4 text-amber-700" />
                <span>Quét QR Để Mở & Tải App Trên Điện Thoại</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Nhân viên bếp dùng camera iPhone hoặc Zalo/Chrome trên Android quét mã QR này để truy cập và cài App ngay.
              </p>

              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-amber-300 rounded-xl text-stone-800 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã chép' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Close */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
