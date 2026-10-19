import React, { useState } from 'react';
import { NavItem } from '../types.ts';
import { DynamicIcon } from './DynamicIcon.tsx';
import { Edit3, Save, Check, FileText, Sparkles } from 'lucide-react';

interface CustomPageViewProps {
  navItem: NavItem;
  onUpdateNavItem: (updated: NavItem) => void;
}

export const CustomPageView: React.FC<CustomPageViewProps> = ({
  navItem,
  onUpdateNavItem,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(navItem.customTitle || navItem.label);
  const [content, setContent] = useState(
    navItem.customContent ||
      'Đây là mục tài liệu / hướng dẫn tùy chỉnh do Quản lý thiết lập trên thanh công cụ.'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    onUpdateNavItem({
      ...navItem,
      customTitle: title,
      customContent: content,
    });
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 mb-6 border-b border-stone-100 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-100 text-amber-900 rounded-xl border border-amber-200">
              <DynamicIcon name={navItem.iconName} className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full uppercase">
                Mục Tùy Chỉnh Thanh Công Cụ
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
                {navItem.customTitle || navItem.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Đã lưu!
              </span>
            )}
            {isEditing ? (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Nội Dung</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold border border-stone-300 transition flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-stone-500" />
                <span>Chỉnh Sửa Trang Này</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Box */}
        {isEditing ? (
          <div className="space-y-4 bg-stone-50 p-5 rounded-2xl border border-stone-200">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Tiêu Đề Trang
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Nội Dung Hướng Dẫn / Quy Trình / Ghi Chú
              </label>
              <textarea
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-3 bg-white border border-stone-300 rounded-xl text-sm font-mono leading-relaxed focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Nhập nội dung quy định bếp, checklist kiểm kê, hoặc các bước thực hiện..."
              />
            </div>
          </div>
        ) : (
          <div className="prose max-w-none text-stone-800 text-sm leading-relaxed bg-stone-50/60 p-6 rounded-2xl border border-stone-200 whitespace-pre-wrap font-sans">
            {content}
          </div>
        )}
      </div>
    </div>
  );
};
