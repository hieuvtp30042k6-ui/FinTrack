import React, { useEffect, useState, useCallback, useMemo } from "react";
import { getCategoriesApi, CategoryModel, createCategoryApi, updateCategoryApi, deleteCategoryApi } from "../../services/api";
import { Pagination } from "../../components/Pagination";
import { useTranslation } from "../../utils/i18n";

// ─── Icons list ───────────────────────────────────────────────────────────────
const ICONS = [
  "restaurant", "shopping_bag", "directions_car", "receipt_long", "home",
  "medical_services", "sports_esports", "payments", "workspace_premium",
  "trending_up", "savings", "flight", "school", "fitness_center",
  "local_cafe", "music_note", "pets", "child_care", "business",
  "attach_money", "credit_card", "account_balance", "category"
];

// ─── Modal Form ───────────────────────────────────────────────────────────────
interface CategoryFormModalProps {
  mode: "create" | "edit";
  item?: CategoryModel;
  onClose: () => void;
  onSave: (isEdit: boolean) => void;
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({ mode, item, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(item?.name || "");
  const [type, setType] = useState<"INCOME" | "EXPENSE">(item?.type || "EXPENSE");
  const [icon, setIcon] = useState(item?.icon || "category");
  const [description, setDescription] = useState(item?.description || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t("admin.cat.err_name_empty", "Tên danh mục không được để trống.")); return; }
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        await createCategoryApi({ name: name.trim(), type, icon, description: description.trim() || undefined });
      } else if (item) {
        await updateCategoryApi(item.id, { name: name.trim(), type, icon, description: description.trim() || undefined });
      }
      onSave(mode === "edit");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("error.unknown", "Lỗi khi lưu danh mục."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-[fadeIn_.2s_ease]">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            {mode === "create" ? t("admin.cat.new_title", "Thêm danh mục mới") : t("admin.cat.edit_title", "Chỉnh sửa danh mục")}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer" type="button">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              {t("admin.cat.name_required", "Tên danh mục *")}
            </label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={t("admin.cat.name_placeholder", "Ví dụ: Ăn uống, Giải trí...")}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                {t("admin.cat.type", "Loại")}
              </label>
              <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(["EXPENSE", "INCOME"] as const).map(tType => (
                  <button key={tType} type="button" onClick={() => setType(tType)}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors cursor-pointer ${type === tType
                      ? tType === "EXPENSE" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                    {tType === "EXPENSE" ? t("admin.cat.expense", "Chi tiêu") : t("admin.cat.income", "Thu nhập")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                {t("admin.cat.current_icon", "Icon hiện tại")}
              </label>
              <div className="h-[38px] flex items-center gap-2 px-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="material-symbols-outlined text-[20px] text-slate-700 dark:text-slate-200">{icon}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{icon}</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              {t("admin.cat.select_icon", "Chọn biểu tượng")}
            </label>
            <div className="grid grid-cols-8 gap-1.5 max-h-28 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${icon === ic ? "bg-slate-900 dark:bg-blue-600 text-white shadow-md" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                  <span className="material-symbols-outlined text-[18px]">{ic}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              {t("admin.cat.desc_optional", "Mô tả (tuỳ chọn)")}
            </label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder={t("admin.cat.desc_placeholder", "Mô tả ngắn về danh mục...")}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              {t("action.cancel", "Hủy")}
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
              {loading ? t("admin.cat.saving", "Đang lưu...") : mode === "create" ? t("admin.cat.add_btn", "Thêm danh mục") : t("admin.cat.save_changes", "Lưu thay đổi")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────
export const AdminCategoriesView: React.FC = () => {
  const { t, lang } = useTranslation();
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CategoryModel | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<CategoryModel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCategories(await getCategoriesApi()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : t("error.unknown", "Không thể tải danh mục.")); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSave = async (isEdit: boolean) => {
    setShowForm(false); setEditItem(undefined);
    await load();
    showSuccess(isEdit ? t("admin.cat.success_update", "Cập nhật danh mục thành công!") : t("admin.cat.success_create", "Thêm danh mục mới thành công!"));
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCategoryApi(confirmDelete.id);
      setConfirmDelete(null); await load();
      showSuccess(t("admin.cat.success_delete", "Đã xóa danh mục thành công!"));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("error.unknown", "Lỗi khi xóa danh mục.")); setConfirmDelete(null);
    } finally { setDeleting(false); }
  };

  const systemCats = categories.filter(c => !c.user_id);
  const userCats = categories.filter(c => c.user_id);

  // Phân trang danh mục
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const allFiltered = useMemo(() => {
    const list = categories.filter(c => filter === "ALL" ? true : c.type === filter);
    return [...list.filter(c => !c.user_id), ...list.filter(c => c.user_id)];
  }, [categories, filter]);

  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allFiltered.slice(start, start + pageSize);
  }, [allFiltered, currentPage, pageSize]);

  const filtered = (list: CategoryModel[]) => filter === "ALL" ? list : list.filter(c => c.type === filter);

  const renderRow = (c: CategoryModel, isSystem: boolean) => (
    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors group">
      <td className="py-3 px-5 font-mono text-xs text-slate-400 dark:text-slate-500">#{c.id}</td>
      <td className="py-3 px-5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.type === "INCOME" ? "bg-emerald-50 dark:bg-emerald-950/50" : "bg-rose-50 dark:bg-rose-950/50"}`}>
            <span className={`material-symbols-outlined text-[20px] ${c.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
              {c.icon || "category"}
            </span>
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white text-sm">{c.name}</div>
            {c.description && <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[180px]">{c.description}</div>}
          </div>
        </div>
      </td>
      <td className="py-3 px-5">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.type === "INCOME" ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${c.type === "INCOME" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
          {c.type === "INCOME" ? t("admin.cat.income", "Thu nhập") : t("admin.cat.expense", "Chi tiêu")}
        </span>
      </td>
      <td className="py-3 px-5">
        {isSystem ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-[11px]">shield</span> {t("admin.cat.system_tag", "Hệ thống")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span className="material-symbols-outlined text-[11px]">person</span> {t("admin.cat.user_tag", "Cá nhân")}
          </span>
        )}
      </td>
      <td className="py-3 px-5 text-xs text-slate-500 dark:text-slate-400">
        {new Date(c.created_at).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US")}
      </td>
      <td className="py-3 px-5 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isSystem && (
            <>
              <button type="button" onClick={() => { setEditItem(c); setShowForm(true); }}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title={t("action.edit", "Chỉnh sửa")}>
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button type="button" onClick={() => setConfirmDelete(c)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer" title={t("action.delete", "Xóa")}>
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("admin.cat.title", "Quản lý danh mục hệ thống")}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {systemCats.length} {t("admin.cat.system_count", "hệ thống")} · {userCats.length} {t("admin.cat.user_count", "người dùng tạo")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[15px]">refresh</span>{t("action.refresh", "Làm mới")}
          </button>
          <button onClick={() => { setEditItem(undefined); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:hover:bg-blue-500 shadow-sm transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[15px]">add</span>{t("admin.cat.add_btn", "Thêm danh mục")}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-[fadeIn_.3s_ease]">
          <span className="material-symbols-outlined text-base">check_circle</span>{successMsg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("admin.cat.total", "Tổng danh mục"), value: categories.length, icon: "category", bg: "bg-slate-900 dark:bg-slate-800", val: "text-white", lbl: "text-slate-400", ico: "text-white" },
          { label: t("admin.cat.sys_default", "Hệ thống (mặc định)"), value: systemCats.length, icon: "shield", bg: "bg-white dark:bg-slate-900", val: "text-slate-900 dark:text-white", lbl: "text-slate-500 dark:text-slate-400", ico: "text-blue-600 dark:text-blue-400" },
          { label: t("admin.cat.expense", "Chi tiêu"), value: categories.filter(c => c.type === "EXPENSE").length, icon: "trending_down", bg: "bg-white dark:bg-slate-900", val: "text-rose-600 dark:text-rose-400", lbl: "text-slate-500 dark:text-slate-400", ico: "text-rose-500" },
          { label: t("admin.cat.income", "Thu nhập"), value: categories.filter(c => c.type === "INCOME").length, icon: "trending_up", bg: "bg-white dark:bg-slate-900", val: "text-emerald-600 dark:text-emerald-400", lbl: "text-slate-500 dark:text-slate-400", ico: "text-emerald-500" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 shadow-sm ${s.bg} ${s.bg.includes("bg-slate-900") ? "border-slate-800" : "border-slate-200/80 dark:border-slate-800"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`material-symbols-outlined text-[18px] ${s.ico}`}>{s.icon}</span>
              <span className={`text-xs font-medium ${s.lbl}`}>{s.label}</span>
            </div>
            <div className={`text-2xl font-bold ${s.val}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
            {(["ALL", "EXPENSE", "INCOME"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`px-4 py-2 font-semibold transition-colors cursor-pointer ${filter === f ? "bg-slate-900 dark:bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                {f === "ALL" ? t("admin.cat.all", "Tất cả") : f === "EXPENSE" ? t("admin.cat.expense", "Chi tiêu") : t("admin.cat.income", "Thu nhập")}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">{filtered(systemCats).length + filtered(userCats).length} {t("admin.cat.item_name", "danh mục")}</span>
        </div>
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            <span className="text-sm">{t("admin.cat.loading", "Đang tải danh mục...")}</span>
          </div>
        ) : error ? (
          <div className="m-4 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>{error}
            <button onClick={load} className="ml-auto underline cursor-pointer">{t("action.refresh", "Thử lại")}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-5 text-left">ID</th>
                  <th className="py-3 px-5 text-left">{t("admin.cat.name", "Tên danh mục")}</th>
                  <th className="py-3 px-5 text-left">{t("admin.cat.type", "Loại")}</th>
                  <th className="py-3 px-5 text-left">{t("admin.cat.source", "Nguồn")}</th>
                  <th className="py-3 px-5 text-left">{t("admin.cat.created_at", "Ngày tạo")}</th>
                  <th className="py-3 px-5 text-right">{t("admin.cat.actions", "Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {paginatedCategories.map(c => renderRow(c, !c.user_id))}
                {allFiltered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300 dark:text-slate-600">category</span>
                      {t("admin.cat.empty", "Không có danh mục nào phù hợp.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang danh mục */}
        {allFiltered.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={allFiltered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            itemName={t("admin.cat.item_name", "danh mục")}
          />
        )}
      </div>

      {showForm && (
        <CategoryFormModal mode={editItem ? "edit" : "create"} item={editItem}
          onClose={() => { setShowForm(false); setEditItem(undefined); }} onSave={handleSave} />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-[fadeIn_.2s_ease]">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-2xl text-rose-600 dark:text-rose-400">delete</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">{t("admin.cat.delete_title", "Xác nhận xóa danh mục?")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t("admin.cat.delete_confirm", "Danh mục sẽ bị xóa.")} <strong className="text-slate-800 dark:text-slate-200">"{confirmDelete.name}"</strong></p>
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-2.5 mb-5">
              {t("admin.cat.delete_note", "Lưu ý: Nếu danh mục đã được sử dụng trong giao dịch, thao tác này sẽ thất bại để bảo toàn dữ liệu.")}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                {t("action.cancel", "Hủy")}
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5">
                {deleting && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                {deleting ? t("admin.cat.deleting", "Đang xóa...") : t("admin.cat.confirm_delete", "Xác nhận xóa")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
