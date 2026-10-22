import React, { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RootErrorBoundary caught error:', error, errorInfo);
  }

  handleHardReset = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) r.unregister();
        });
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
              👨‍🍳
            </div>
            <h1 className="text-base font-bold text-white">Khôi Phục Giao Diện Bếp Pro</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Trình duyệt vừa phát hiện xung đột bộ nhớ đệm cache phiên bản cũ sau khi cập nhật mã nguồn mới.
            </p>
            {this.state.error && (
              <div className="p-3 bg-black/60 rounded-xl text-[11px] font-mono text-rose-300 text-left overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={this.handleHardReset}
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow-md cursor-pointer"
              >
                🔄 Xóa Cache & Tải Lại Trang Ngay
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
