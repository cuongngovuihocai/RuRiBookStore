import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  Heart,
  Link2,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {useState} from 'react';
import type {AudioChapter, AudioStory, CategoryDoc, ListenerStoryState} from '../types';
import {
  formatDuration,
  getAudioDurationFromUrl,
  normalizeExternalAudioUrl,
} from '../utils/format';

interface StoryDetailModalProps {
  story: AudioStory | null;
  listenerState: ListenerStoryState;
  isAdminView: boolean;
  isAdminAuthorized: boolean;
  categories: CategoryDoc[];
  currentStoryId: string | null;
  currentChapterIndex: number;
  isPlaying: boolean;
  onClose: () => void;
  onPlayChapter: (story: AudioStory, chapterIndex: number) => void;
  onToggleFavorite: (story: AudioStory) => void;
  onUpdateStory: (id: string, patch: Partial<AudioStory>) => Promise<void>;
  onDeleteStory: (id: string) => Promise<void>;
  onSelectKeyword: (kw: string) => void;
}

export function StoryDetailModal({
  story,
  listenerState,
  isAdminView,
  isAdminAuthorized,
  categories,
  currentStoryId,
  currentChapterIndex,
  isPlaying,
  onClose,
  onPlayChapter,
  onToggleFavorite,
  onUpdateStory,
  onDeleteStory,
  onSelectKeyword,
}: StoryDetailModalProps) {
  const canManage = isAdminView && isAdminAuthorized;

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editNarrator, setEditNarrator] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newChTitle, setNewChTitle] = useState('');
  const [newChUrl, setNewChUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (!story) return null;

  const startEdit = () => {
    setEditTitle(story.title);
    setEditAuthor(story.author);
    setEditNarrator(story.narrator);
    setEditCategory(story.category);
    setEditKeywords(story.keywords.join(', '));
    setEditDesc(story.description);
    setEditCoverUrl(story.coverUrl);
    setIsEditing(true);
    setConfirmDelete(false);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setStatusError(null);
    try {
      await onUpdateStory(story.id, {
        title: editTitle.trim() || story.title,
        author: editAuthor.trim(),
        narrator: editNarrator.trim(),
        category: editCategory.trim() || story.category,
        keywords: editKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        description: editDesc.trim(),
        coverUrl: editCoverUrl.trim() || story.coverUrl,
      });
      setIsEditing(false);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Không thể cập nhật thông tin.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddLinkChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newChUrl.trim();
    if (!trimmed) return;
    setIsBusy(true);
    setStatusError(null);
    try {
      const norm = normalizeExternalAudioUrl(trimmed);
      const check = await getAudioDurationFromUrl(norm.playableUrl);

      const newChapter: AudioChapter = {
        id: `ch-${crypto.randomUUID()}`,
        title: newChTitle.trim() || `Chương ${story.chapters.length + 1}`,
        sourceType: 'url',
        audioUrl: norm.playableUrl,
        originalUrl: trimmed,
        durationSec: check.durationSec,
      };

      await onUpdateStory(story.id, {
        chapters: [...story.chapters, newChapter],
      });
      setNewChTitle('');
      setNewChUrl('');
      setIsAddingLink(false);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Không thể thêm chương mới.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveChapter = async (chapterId: string) => {
    if (story.chapters.length <= 1) {
      setStatusError('Truyện cần giữ lại ít nhất 1 chương.');
      return;
    }
    await onUpdateStory(story.id, {
      chapters: story.chapters.filter((c) => c.id !== chapterId),
    });
  };

  const totalDuration = story.chapters.reduce((acc, ch) => acc + (ch.durationSec || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-story-title"
    >
      <div
        className="fixed inset-0 bg-[#1B1408]/50 backdrop-blur-xs dark:bg-[#0B0917]/70"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#DEC999] bg-[#FDF8EB] shadow-2xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DEC999] px-6 py-4 dark:border-[#2E294D]">
          <span className="text-xs font-medium text-[#6D5937] dark:text-[#ACA4CA]">
            {story.category} · {story.chapters.length} chương
            {totalDuration > 0 ? ` · ${formatDuration(totalDuration)}` : ''}
            {canManage && !story.isPublished ? ' · Bản nháp' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleFavorite(story)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
              aria-label="Yêu thích"
            >
              <Heart
                className={`h-4 w-4 ${
                  listenerState.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onUpdateStory(story.id, {isPublished: !story.isPublished})}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                >
                  {story.isPublished ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Ẩn truyện</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Công khai</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => (isEditing ? setIsEditing(false) : startEdit())}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isEditing ? 'Huỷ sửa' : 'Sửa thông tin'}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {statusError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
              {statusError}
            </div>
          )}

          {canManage && isEditing ? (
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                    Tên truyện
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                    Tác giả
                  </label>
                  <input
                    type="text"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                    Giọng đọc
                  </label>
                  <input
                    type="text"
                    value={editNarrator}
                    onChange={(e) => setEditNarrator(e.target.value)}
                    className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                    Phân loại
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                    Từ khoá
                  </label>
                  <input
                    type="text"
                    value={editKeywords}
                    onChange={(e) => setEditKeywords(e.target.value)}
                    className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                    Link ảnh bìa
                  </label>
                  <input
                    type="text"
                    value={editCoverUrl}
                    onChange={(e) => setEditCoverUrl(e.target.value)}
                    className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                    Mô tả
                  </label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-[#D3BC87] px-3.5 py-2 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A4B0C] px-4 py-2 text-xs font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="h-48 w-36 shrink-0 overflow-hidden rounded-xl border border-[#DEC999] bg-[#EFE0BA] dark:border-[#322C52] dark:bg-[#231F3D]">
                <img
                  src={story.coverUrl}
                  alt={story.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 space-y-3">
                <h2
                  id="detail-story-title"
                  className="font-display text-2xl font-semibold leading-tight text-[#2B2111] dark:text-[#F4EFFB]"
                >
                  {story.title}
                </h2>
                <p className="text-sm text-[#5C492B] dark:text-[#ACA4CA]">
                  Tác giả:{' '}
                  <span className="font-medium text-[#2B2111] dark:text-[#E8E2F7]">{story.author}</span>
                  {' · '}
                  Giọng đọc:{' '}
                  <span className="font-medium text-[#2B2111] dark:text-[#E8E2F7]">
                    {story.narrator}
                  </span>
                </p>
                {story.description && (
                  <p className="text-sm leading-relaxed text-[#4B3B21] dark:text-[#CFC8E6]">
                    {story.description}
                  </p>
                )}
                {story.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-1 text-xs text-[#6D5937] dark:text-[#9E94C0]">
                    {story.keywords.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => {
                          onSelectKeyword(kw);
                          onClose();
                        }}
                        className="hover:text-[#7A4B0C] hover:underline dark:hover:text-[#D5B263]"
                      >
                        #{kw}
                      </button>
                    ))}
                  </div>
                )}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onPlayChapter(story, listenerState.lastChapterIndex || 0)}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#7A4B0C] px-4 py-2 text-sm font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>
                      {listenerState.lastPositionSec > 5 ? 'Nghe tiếp vị trí đang dở' : 'Phát từ đầu'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chapters List */}
          <div className="border-t border-[#DEC999] pt-5 dark:border-[#2E294D]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                Danh sách chương ({story.chapters.length})
              </h3>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsAddingLink((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D3BC87] px-2.5 py-1.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm link chương</span>
                </button>
              )}
            </div>

            {canManage && isAddingLink && (
              <form
                onSubmit={handleAddLinkChapter}
                className="mb-3 flex flex-col gap-2 rounded-xl border border-[#DEC999] bg-[#F7ECCE]/70 p-3 sm:flex-row dark:border-[#302B4F] dark:bg-[#19162D]"
              >
                <input
                  type="text"
                  value={newChTitle}
                  onChange={(e) => setNewChTitle(e.target.value)}
                  placeholder="Tên chương..."
                  className="rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-1.5 text-xs text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none sm:w-40 dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8]"
                />
                <input
                  type="url"
                  required
                  value={newChUrl}
                  onChange={(e) => setNewChUrl(e.target.value)}
                  placeholder="Link R2 / Archive.org / MP3..."
                  className="flex-1 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-1.5 text-xs text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8]"
                />
                <button
                  type="submit"
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#7A4B0C] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  <span>Thêm</span>
                </button>
              </form>
            )}

            <div className="divide-y divide-[#ECDCB4] rounded-xl border border-[#DEC999] bg-[#FFFDF6]/70 dark:divide-[#2E294D] dark:border-[#302B4F] dark:bg-[#19162D]/60">
              {story.chapters.map((ch, idx) => {
                const isActiveChapter = currentStoryId === story.id && currentChapterIndex === idx;
                return (
                  <div
                    key={ch.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      isActiveChapter ? 'bg-[#EFE0BA]/75 dark:bg-[#292447]/80' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPlayChapter(story, idx)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFE0BA] text-[#3B2E17] dark:bg-[#292447] dark:text-[#E5DEF9]">
                        {isActiveChapter && isPlaying ? (
                          <Pause className="h-3.5 w-3.5 fill-current text-[#7A4B0C] dark:text-[#D5B263]" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${
                            isActiveChapter
                              ? 'text-[#7A4B0C] dark:text-[#D5B263]'
                              : 'text-[#2B2111] dark:text-[#F1ECF8]'
                          }`}
                        >
                          {ch.title}
                        </p>
                        {ch.durationSec > 0 && (
                          <p className="font-mono-tabular text-xs text-[#6D5937] dark:text-[#9E94C0]">
                            {formatDuration(ch.durationSec)}
                          </p>
                        )}
                      </div>
                    </button>

                    {canManage && story.chapters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChapter(ch.id)}
                        className="rounded p-1.5 text-[#856F4B] hover:bg-[#EFE0BA] hover:text-rose-600 dark:text-[#9E94C0] dark:hover:bg-[#292447]"
                        title="Xoá chương"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#DEC999] px-6 py-3.5 dark:border-[#2E294D]">
          {canManage ? (
            !confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:underline dark:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xoá truyện này</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
                  Xác nhận xoá vĩnh viễn?
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteStory(story.id);
                    onClose();
                  }}
                  className="rounded-md bg-rose-700 px-3 py-1 text-xs font-medium text-white hover:bg-rose-800"
                >
                  Đồng ý xoá
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-[#D3BC87] px-2.5 py-1 text-xs text-[#4B3B21] dark:border-[#37315A] dark:text-[#DCD6F0]"
                >
                  Huỷ
                </button>
              </div>
            )
          ) : (
            <span className="text-xs text-[#6D5937] dark:text-[#9E94C0]">
              Bấm vào tên chương bất kỳ để bắt đầu nghe
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#D3BC87] px-4 py-1.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
