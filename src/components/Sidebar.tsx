import {FolderPlus, Trash2, X} from 'lucide-react';
import {useState} from 'react';
import type {AudioStory, CategoryDoc, LibraryStats, NavSection} from '../types';
import {formatTotalDurationVi} from '../utils/format';

interface SidebarProps {
  isAdminView: boolean;
  isAdminAuthorized: boolean;
  stories: AudioStory[];
  categories: CategoryDoc[];
  selectedCategory: string | null;
  selectedKeyword: string | null;
  activeSection: NavSection;
  stats: LibraryStats;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSelectSection: (section: NavSection) => void;
  onSelectCategory: (category: string | null) => void;
  onSelectKeyword: (keyword: string | null) => void;
  onAddCategory: (name: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

export function Sidebar({
  isAdminView,
  isAdminAuthorized,
  stories,
  categories,
  selectedCategory,
  selectedKeyword,
  activeSection,
  stats,
  isOpenMobile,
  onCloseMobile,
  onSelectSection,
  onSelectCategory,
  onSelectKeyword,
  onAddCategory,
  onDeleteCategory,
}: SidebarProps) {
  const [newCategory, setNewCategory] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);

  const canManage = isAdminView && isAdminAuthorized;

  const categoryCounts = new Map<string, number>();
  for (const cat of categories) {
    categoryCounts.set(cat.name, 0);
  }
  for (const story of stories) {
    categoryCounts.set(story.category, (categoryCounts.get(story.category) || 0) + 1);
  }

  const keywordCounts = new Map<string, number>();
  for (const story of stories) {
    for (const kw of story.keywords) {
      const clean = kw.trim();
      if (clean) {
        keywordCounts.set(clean, (keywordCounts.get(clean) || 0) + 1);
      }
    }
  }
  const sortedKeywords = Array.from(keywordCounts.entries()).sort((a, b) => b[1] - a[1]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    await onAddCategory(trimmed);
    setNewCategory('');
    setShowNewCatInput(false);
  };

  const mobileNavList: {id: NavSection; label: string}[] = isAdminView
    ? [
        {id: 'all', label: 'Kho truyện'},
        {id: 'drafts', label: 'Bản nháp'},
        {id: 'backup', label: 'Sao lưu JSON'},
      ]
    : [
        {id: 'all', label: 'Tất cả truyện'},
        {id: 'in_progress', label: 'Đang nghe'},
        {id: 'favorites', label: 'Yêu thích'},
      ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between gap-8 py-6 px-5">
      <div className="space-y-7">
        {/* Mobile quick nav */}
        <div className="space-y-1.5 md:hidden">
          <p className="text-xs font-semibold tracking-wide text-[#6D5937] dark:text-[#A99FCA]">
            Thư viện
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {mobileNavList.map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  onSelectSection(nav.id);
                  onCloseMobile();
                }}
                className={`min-h-[40px] rounded-lg px-3 py-2 text-left text-xs font-medium whitespace-nowrap transition-colors ${
                  activeSection === nav.id
                    ? 'bg-[#7A4B0C] text-white dark:bg-[#6A58C8]'
                    : 'bg-[#EAD9AF] text-[#3B2E17] hover:bg-[#E1CC99] dark:bg-[#231F3D] dark:text-[#DCD6F0]'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Section */}
        <section aria-label="Phân loại truyện">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sans text-xs font-semibold tracking-wide text-[#6D5937] dark:text-[#A99FCA]">
              Phân loại
            </h2>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowNewCatInput((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#7A4B0C] hover:text-[#4F2F05] dark:text-[#D5B263] dark:hover:text-[#ECCD85]"
                title="Thêm phân loại mới"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Thêm</span>
              </button>
            )}
          </div>

          {canManage && showNewCatInput && (
            <form onSubmit={handleCreateCategory} className="mb-3 flex gap-1.5">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Tên phân loại mới..."
                className="w-full rounded-lg border border-[#D8C28F] bg-[#FFFDF6] px-2.5 py-1.5 text-xs text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#39335E] dark:bg-[#1E1B33] dark:text-[#F1ECF8]"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-lg bg-[#7A4B0C] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8]"
              >
                Lưu
              </button>
            </form>
          )}

          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => {
                  onSelectCategory(null);
                  onCloseMobile();
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  selectedCategory === null
                    ? 'bg-[#E9D7AA] font-semibold text-[#241A0B] dark:bg-[#292447] dark:text-[#F4EFFB]'
                    : 'text-[#4B3B21] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#211D38]'
                }`}
              >
                <span className="truncate">Tất cả phân loại</span>
                <span className="font-mono-tabular text-xs text-[#735E3B] dark:text-[#9D93BF]">
                  {stories.length}
                </span>
              </button>
            </li>
            {Array.from(categoryCounts.entries()).map(([catName, count]) => {
              const isSelected = selectedCategory === catName;
              const catDoc = categories.find((c) => c.name === catName);
              return (
                <li key={catName} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory(isSelected ? null : catName);
                      onCloseMobile();
                    }}
                    className={`flex flex-1 min-w-0 items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'bg-[#7A4B0C]/15 font-semibold text-[#5C3606] dark:bg-[#6A58C8]/25 dark:text-[#E5DEF9]'
                        : 'text-[#4B3B21] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#211D38]'
                    }`}
                  >
                    <span className="truncate text-left">{catName}</span>
                    <span className="font-mono-tabular text-xs text-[#735E3B] dark:text-[#9D93BF]">
                      {count}
                    </span>
                  </button>
                  {canManage && catDoc && count === 0 && (
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(catDoc.id)}
                      className="rounded p-1.5 text-[#856F4B] opacity-0 transition-opacity hover:text-rose-700 group-hover:opacity-100 dark:text-[#9D93BF] dark:hover:text-rose-400"
                      title="Xoá phân loại trống"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Keywords Section */}
        <section aria-label="Từ khoá">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sans text-xs font-semibold tracking-wide text-[#6D5937] dark:text-[#A99FCA]">
              Từ khoá
            </h2>
            {selectedKeyword && (
              <button
                type="button"
                onClick={() => onSelectKeyword(null)}
                className="text-xs font-medium text-[#7A4B0C] hover:underline dark:text-[#D5B263]"
              >
                Bỏ chọn
              </button>
            )}
          </div>

          {sortedKeywords.length === 0 ? (
            <p className="text-xs text-[#735E3B] dark:text-[#8E84B2]">Chưa có từ khoá nào.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sortedKeywords.map(([kw, count]) => {
                const isSelected = selectedKeyword === kw;
                return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      onSelectKeyword(isSelected ? null : kw);
                      onCloseMobile();
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-[#7A4B0C] bg-[#7A4B0C] text-white dark:border-[#6A58C8] dark:bg-[#6A58C8]'
                        : 'border-[#DEC999] bg-[#FDF8EA] text-[#4B3B21] hover:border-[#C9AF76] hover:bg-[#F7ECCF] dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#D6CFF0] dark:hover:border-[#494173]'
                    }`}
                  >
                    <span>#{kw}</span>
                    <span
                      className={`font-mono-tabular text-[11px] ${
                        isSelected
                          ? 'text-amber-100 dark:text-indigo-100'
                          : 'text-[#87714D] dark:text-[#8E84B2]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Clean Library Summary */}
      <div className="border-t border-[#DEC999] pt-4 dark:border-[#2E294D]">
        <p className="mb-2.5 text-xs font-semibold tracking-wide text-[#6D5937] dark:text-[#A99FCA]">
          Thống kê thư viện
        </p>
        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[#5C492B] dark:text-[#ACA4CA]">
            <dt>Tổng số truyện</dt>
            <dd className="font-mono-tabular font-medium text-[#2B2111] dark:text-[#F1ECF8]">
              {stats.totalStories}
            </dd>
          </div>
          <div className="flex items-center justify-between text-[#5C492B] dark:text-[#ACA4CA]">
            <dt>Tổng số chương</dt>
            <dd className="font-mono-tabular font-medium text-[#2B2111] dark:text-[#F1ECF8]">
              {stats.totalChapters}
            </dd>
          </div>
          <div className="flex items-center justify-between text-[#5C492B] dark:text-[#ACA4CA]">
            <dt>Tổng thời lượng</dt>
            <dd className="font-mono-tabular font-medium text-[#2B2111] dark:text-[#F1ECF8]">
              {formatTotalDurationVi(stats.totalDurationSec)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-[260px] shrink-0 border-r border-[#DEC999] bg-[#F7ECCE]/60 lg:block dark:border-[#2E294D] dark:bg-[#19162D]/70">
        <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">{sidebarContent}</div>
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#1B1408]/45 backdrop-blur-xs dark:bg-[#0B0917]/65"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-[#F5E8C7] shadow-xl dark:bg-[#19162D]">
            <div className="flex items-center justify-between border-b border-[#DEC999] px-5 py-4 dark:border-[#2E294D]">
              <span className="font-display text-base font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                Danh mục & Từ khoá
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#E9D7AA] dark:text-[#B9B1D4] dark:hover:bg-[#292447]"
                aria-label="Đóng danh mục"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
