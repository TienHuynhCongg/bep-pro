import React, { useState } from 'react';
import { KitchenRecipe, RecipeIngredient, StaffUser } from '../types.ts';
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  Search,
  Edit2,
  X,
  Utensils,
} from 'lucide-react';

interface RecipeBookViewProps {
  recipes: KitchenRecipe[];
  onSaveRecipe: (recipe: KitchenRecipe, isEdit: boolean) => void;
  onDeleteRecipe: (id: string) => void;
  currentUser?: StaffUser | null;
}

const COMMON_UNITS = [
  'g',
  'kg',
  'ml',
  'lít',
  'muỗng',
  'muỗng cà phê',
  'muỗng canh',
  'quả',
  'củ',
  'cái',
  'lát',
  'phần',
];

const createEmptyIngredient = (): RecipeIngredient => ({
  id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  quantity: '',
  unit: 'g',
});

// Chỉ cho phép nhập chữ số và tối đa 1 dấu chấm/phẩy thập phân
function sanitizeNumericInput(raw: string): string {
  const normalized = raw.replace(/,/g, '.');
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

export const RecipeBookView: React.FC<RecipeBookViewProps> = ({
  recipes,
  onSaveRecipe,
  onDeleteRecipe,
  currentUser = null,
}) => {
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [dishName, setDishName] = useState<string>('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    createEmptyIngredient(),
    createEmptyIngredient(),
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAddIngredientRow = () => {
    setIngredients((prev) => [...prev, createEmptyIngredient()]);
  };

  const handleRemoveIngredientRow = (id: string) => {
    if (ingredients.length <= 1) {
      setIngredients([createEmptyIngredient()]);
      return;
    }
    setIngredients((prev) => prev.filter((item) => item.id !== id));
  };

  const handleChangeIngredient = (
    id: string,
    field: 'name' | 'quantity' | 'unit',
    value: string
  ) => {
    setFormError('');
    setIngredients((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'quantity') {
          return { ...item, quantity: sanitizeNumericInput(value) };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleResetForm = () => {
    setEditingRecipeId(null);
    setDishName('');
    setIngredients([createEmptyIngredient(), createEmptyIngredient()]);
    setFormError('');
  };

  const handleStartEdit = (recipe: KitchenRecipe) => {
    setEditingRecipeId(recipe.id);
    setDishName(recipe.dishName);
    setIngredients(
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((i) => ({ ...i }))
        : [createEmptyIngredient()]
    );
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDish = dishName.trim();
    if (!trimmedDish) {
      setFormError('Vui lòng nhập Tên món ở ô trên cùng!');
      return;
    }

    const validIngredients = ingredients
      .map((i) => ({
        ...i,
        name: i.name.trim(),
        quantity: i.quantity.trim(),
        unit: i.unit.trim() || 'g',
      }))
      .filter((i) => i.name !== '' || i.quantity !== '');

    if (validIngredients.length === 0) {
      setFormError('Vui lòng nhập ít nhất 1 nguyên liệu kèm số lượng!');
      return;
    }

    const missingField = validIngredients.find((i) => !i.name || !i.quantity);
    if (missingField) {
      setFormError('Vui lòng điền đầy đủ Tên nguyên liệu và Số lượng (số) cho các dòng đã nhập!');
      return;
    }

    const nowStr = new Date().toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const recipePayload: KitchenRecipe = {
      id: editingRecipeId || `recipe-${Date.now()}`,
      dishName: trimmedDish,
      ingredients: validIngredients,
      createdBy: currentUser?.fullName || 'Đầu Bếp',
      updatedAt: nowStr,
    };

    onSaveRecipe(recipePayload, Boolean(editingRecipeId));
    handleResetForm();
  };

  const filteredRecipes = recipes.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const matchDish = r.dishName.toLowerCase().includes(q);
    const matchIng = r.ingredients.some((i) => i.name.toLowerCase().includes(q));
    return matchDish || matchIng;
  });

  return (
    <div className="space-y-4">
      {/* Form Lưu Công Thức */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-950">
                {editingRecipeId ? 'Chỉnh Sửa Công Thức Món' : 'Lưu Công Thức Món Ăn'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Gõ tên món ở trên cùng, thêm nguyên liệu, số lượng (chỉ nhập số) và định lượng
              </p>
            </div>
          </div>

          {editingRecipeId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="h-8 px-3 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Hủy sửa</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Ô gõ tên món ở trên cùng */}
          <div>
            <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
              Tên Món Ăn / Sốt <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={dishName}
              onChange={(e) => {
                setDishName(e.target.value);
                setFormError('');
              }}
              placeholder="Ví dụ: Bò lúc lắc sốt tiêu đen, Nước sốt phở trộn..."
              className="w-full h-11 px-3.5 bg-zinc-50 border border-zinc-300 rounded-xl text-sm sm:text-base font-bold text-zinc-950 placeholder:font-normal placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none"
            />
          </div>

          {/* 2. Danh sách các dòng Nguyên liệu + Số lượng (chỉ số) + Định lượng */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                Danh Sách Nguyên Liệu & Định Lượng ({ingredients.length} dòng)
              </label>
              <button
                type="button"
                onClick={handleAddIngredientRow}
                className="h-8 px-3 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm nguyên liệu</span>
              </button>
            </div>

            {/* Header cột trên Desktop */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 text-[11px] font-bold text-zinc-500 uppercase">
              <div className="col-span-6">Tên nguyên liệu (tự ghi)</div>
              <div className="col-span-3">Số lượng (chỉ ghi số)</div>
              <div className="col-span-3">Định lượng (ml, g, kg, muỗng...)</div>
            </div>

            <div className="space-y-2">
              {ingredients.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-2.5 sm:p-2 bg-zinc-50/80 rounded-xl border border-zinc-200/90 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                >
                  {/* Trường nguyên liệu (tự ghi) */}
                  <div className="sm:col-span-6 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleChangeIngredient(item.id, 'name', e.target.value)}
                      placeholder="Tên nguyên liệu (VD: Tỏi băm, Dầu hào...)"
                      className="w-full h-9 px-3 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm font-medium text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none"
                    />
                  </div>

                  {/* Trường số lượng (chỉ được ghi số) + Trường định lượng */}
                  <div className="sm:col-span-6 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => handleChangeIngredient(item.id, 'quantity', e.target.value)}
                        placeholder="Số lượng (số)"
                        className="w-full h-9 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none"
                      />
                    </div>

                    <div className="col-span-5">
                      <input
                        type="text"
                        list="recipe-unit-options"
                        value={item.unit}
                        onChange={(e) => handleChangeIngredient(item.id, 'unit', e.target.value)}
                        placeholder="ml, g, kg, muỗng..."
                        className="w-full h-9 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm font-semibold text-zinc-800 focus:ring-2 focus:ring-zinc-900 outline-none"
                      />
                    </div>

                    <div className="col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(item.id)}
                        className="w-8 h-8 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                        title="Xóa dòng nguyên liệu này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <datalist id="recipe-unit-options">
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>

            {/* Gợi ý chọn nhanh định lượng */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-semibold text-zinc-400">
                Định lượng hay dùng:
              </span>
              {['g', 'kg', 'ml', 'lít', 'muỗng', 'muỗng cà phê', 'muỗng canh', 'phần'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    const lastIdx = ingredients.length - 1;
                    if (lastIdx >= 0) {
                      handleChangeIngredient(ingredients[lastIdx].id, 'unit', u);
                    }
                  }}
                  className="px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[10px] font-semibold transition"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
            <button
              type="button"
              onClick={handleAddIngredientRow}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm dòng</span>
            </button>

            <button
              type="submit"
              className="h-10 px-5 rounded-xl text-xs sm:text-sm font-bold bg-zinc-950 hover:bg-zinc-800 text-white flex items-center gap-2 shadow-xs transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{editingRecipeId ? 'Cập Nhật Công Thức' : 'Lưu Công Thức Món'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Danh Sách Công Thức Đã Lưu */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-zinc-950">
              Sổ Tay Công Thức Đã Lưu
            </h3>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 text-zinc-800">
              {recipes.length} món
            </span>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên món hoặc nguyên liệu..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <Utensils className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
            <p className="text-xs sm:text-sm font-medium">Chưa có công thức món nào được lưu</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/50 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="px-3.5 py-2.5 bg-zinc-900 text-white flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">
                        {recipe.dishName}
                      </h4>
                      <p className="text-[10px] text-zinc-400 truncate">
                        Cập nhật: {recipe.updatedAt} {recipe.createdBy ? `• ${recipe.createdBy}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(recipe)}
                        className="h-7 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>

                      {confirmDeleteId === recipe.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteRecipe(recipe.id);
                            setConfirmDeleteId(null);
                          }}
                          className="h-7 px-2 rounded-lg bg-rose-600 text-white text-[11px] font-bold transition whitespace-nowrap"
                        >
                          Xác nhận xóa
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(recipe.id)}
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white flex items-center justify-center transition"
                          title="Xóa công thức"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bảng nguyên liệu của món */}
                  <div className="divide-y divide-zinc-200/70 bg-white">
                    <div className="grid grid-cols-12 px-3.5 py-1.5 bg-zinc-100/80 text-[10px] font-bold text-zinc-500 uppercase">
                      <div className="col-span-7">Nguyên liệu</div>
                      <div className="col-span-5 text-right">Số lượng & Định lượng</div>
                    </div>
                    {recipe.ingredients.map((ing) => (
                      <div
                        key={ing.id}
                        className="grid grid-cols-12 px-3.5 py-2 text-xs items-center hover:bg-zinc-50"
                      >
                        <div className="col-span-7 font-medium text-zinc-800 pr-2 break-words">
                          {ing.name}
                        </div>
                        <div className="col-span-5 text-right font-mono font-bold text-zinc-950">
                          {ing.quantity}{' '}
                          <span className="font-sans font-semibold text-zinc-600">
                            {ing.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
