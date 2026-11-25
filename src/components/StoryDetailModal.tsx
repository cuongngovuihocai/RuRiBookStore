import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LockOpen,
  Pause,
  Play,
  Plus,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {loadStoryAdminVault, type UpdateStoryPatch} from '../firebase';
import type {
  AudioChapter,
  AudioStory,
  CategoryDoc,
  ListenerStoryState,
  StoryAdminVault,
} from '../types';
import {
  buildStoryShareUrl,
  copyTextToClipboard,
  diagnoseGoogleDriveFile,
  extractGoogleDriveFileId,
  formatDuration,
  getAudioDurationFromUrl,
  normalizeCoverImageUrl,
  normalizeExternalAudioUrl,
  optimizeCoverImageFile,
  resolvePlayableAudioUrl,
} from '../utils/format';
import {decryptStorySecret, type LockedStorySecret} from '../utils/storyLock';
import {checkSupabaseStorageStatus, uploadCoverToSupabase} from '../utils/supabaseUpload';
import {CoverImage} from './CoverImage';

interface StoryDetailModalProps {
  story: AudioStory | null;
  listenerState: ListenerStoryState;
  isAdminView: boolean;
  isAdminAuthorized: boolean;
  isUnlocked?: boolean;
  unlockedSecret?: LockedStorySecret | null;
  autoPlayOnUnlock?: boolean;
  categories: CategoryDoc[];
  currentStoryId: string | null;
  currentChapterIndex: number;
  isPlaying: boolean;
  onClose: () => void;
  onPlayChapter: (story: AudioStory, chapterIndex: number) => void;
  onToggleFavorite: (story: AudioStory) => void;
  onUpdateStory: (id: string, patch: UpdateStoryPatch) => Promise<void>;
  onDeleteStory: (id: string) => Promise<void>;
  onSelectKeyword: (kw: string) => void;
  onUnlockSuccess?: (
    storyId: string,
    secret: LockedStorySecret,
    shouldAutoPlay?: boolean
  ) => void;
}

export function StoryDetailModal({
  story,
  listenerState,
  isAdminView,
  isAdminAuthorized,
  isUnlocked = false,
  unlockedSecret = null,
  autoPlayOnUnlock = false,
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
  onUnlockSuccess,
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
  const [editIsLocked, setEditIsLocked] = useState(false);
  const [editLockPassword, setEditLockPassword] = useState('');
  const [showEditLockPassword, setShowEditLockPassword] = useState(false);

  const [adminVault, setAdminVault] = useState<StoryAdminVault | null>(null);
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newChTitle, setNewChTitle] = useState('');
  const [newChUrl, setNewChUrl] = useState('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChTitle, setEditChTitle] = useState('');
  const [editChUrl, setEditChUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const editCoverFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCopiedLink(false);
    setIsEditing(false);
    setConfirmDelete(false);
    setIsAddingLink(false);
    setEditingChapterId(null);
    setStatusError(null);
    setUnlockPassword('');
    setShowUnlockPassword(false);
    setUnlockError(null);
  }, [story?.id]);

  useEffect(() => {
    if (!story?.id || !canManage || !story.isLocked) {
      setAdminVault(null);
      setIsLoadingVault(false);
      return;
    }

    let active = true;
    setIsLoadingVault(true);
    loadStoryAdminVault(story.id)
      .then((vault) => {
        if (active) setAdminVault(vault);
      })
      .catch((err) => {
        if (active) {
          setStatusError(
            err instanceof Error
              ? err.message
              : 'Không thể tải dữ liệu bảo mật của truyện.'
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingVault(false);
      });

    return () => {
      active = false;
    };
  }, [story?.id, story?.isLocked, story?.updatedAt, canManage]);

  useEffect(() => {
    if (!canManage || !isEditing) return;
    let active = true;
    checkSupabaseStorageStatus().then((st) => {
      if (active) setSupabaseConfigured(st.configured);
    });
    return () => {
      active = false;
    };
  }, [canManage, isEditing]);

  if (!story) return null;

  const isLocked = Boolean(story.isLocked);
  const hasAccess = canManage || !isLocked || isUnlocked;

  const effectiveDescription = isLocked
    ? canManage
      ? adminVault?.description ?? ''
      : isUnlocked && unlockedSecret
        ? unlockedSecret.description
        : ''
    : story.description;

  const effectiveChapters = isLocked
    ? canManage
      ? adminVault?.chapters ?? []
      : isUnlocked && unlockedSecret
        ? unlockedSecret.chapters
        : []
    : story.chapters;

  const effectiveStory: AudioStory = {
    ...story,
    description: effectiveDescription,
    chapters: effectiveChapters,
  };

  const displayChapterCount =
    isLocked && !hasAccess ? story.lockedChapterCount ?? 1 : effectiveChapters.length;

  const totalDuration = hasAccess
    ? effectiveChapters.reduce((acc, ch) => acc + (ch.durationSec || 0), 0)
    : 0;

  const handleShareStory = async () => {
    const ok = await copyTextToClipboard(buildStoryShareUrl(story.id));
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      setUnlockError('Vui lòng nhập mật khẩu để mở khoá truyện.');
      return;
    }
    setIsUnlocking(true);
    setUnlockError(null);
    try {
      const secret = await decryptStorySecret(
        story.lockedPayload || '',
        story.accessSalt || '',
        unlockPassword
      );
      setUnlockPassword('');
      onUnlockSuccess?.(story.id, secret, autoPlayOnUnlock);
    } catch (err) {
      setUnlockError(
        err instanceof Error ? err.message : 'Mật khẩu không đúng, vui lòng thử lại.'
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  const startEdit = () => {
    setEditTitle(story.title);
    setEditAuthor(story.author);
    setEditNarrator(story.narrator);
    setEditCategory(story.category);
    setEditKeywords(story.keywords.join(', '));
    setEditDesc(effectiveDescription);
    setEditCoverUrl(story.coverUrl);
    setEditIsLocked(Boolean(story.isLocked));
    setEditLockPassword(adminVault?.lockPassword || '');
    setShowEditLockPassword(false);
    setIsEditing(true);
    setConfirmDelete(false);
    setStatusError(null);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editIsLocked && !editLockPassword.trim()) {
      setStatusError('Vui lòng nhập mật khẩu để khoá truyện.');
      return;
    }
    setIsBusy(true);
    setStatusError(null);
    try {
      const cleanDesc = editDesc.trim();
      const cleanPass = editLockPassword.trim();
      await onUpdateStory(story.id, {
        title: editTitle.trim() || story.title,
        author: editAuthor.trim(),
        narrator: editNarrator.trim(),
        category: editCategory.trim() || story.category,
        keywords: editKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        description: cleanDesc,
        coverUrl: normalizeCoverImageUrl(editCoverUrl.trim()) || story.coverUrl,
        lockConfig: {
          enabled: editIsLocked,
          password: editIsLocked ? cleanPass : undefined,
        },
      });
      if (editIsLocked) {
        setAdminVault({
          description: cleanDesc,
          chapters: effectiveChapters,
          lockPassword: cleanPass,
        });
      } else {
        setAdminVault(null);
      }
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
    const driveId = extractGoogleDriveFileId(trimmed);
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/samples/') && !driveId) {
      setStatusError('Vui lòng nhập link hợp lệ (https://...) hoặc File ID Google Drive sau /d/.');
      return;
    }
    setIsBusy(true);
    setStatusError(null);
    try {
      const norm = normalizeExternalAudioUrl(trimmed);
      const streamUrl = resolvePlayableAudioUrl(norm.playableUrl);
      const check = await getAudioDurationFromUrl(streamUrl);

      if (norm.isGoogleDrive && !check.ok && norm.driveFileId) {
        const hint = await diagnoseGoogleDriveFile(norm.driveFileId);
        if (hint) {
          setStatusError(hint);
        }
      }

      const newChapter: AudioChapter = {
        id: `ch-${crypto.randomUUID()}`,
        title: newChTitle.trim() || `Chương ${effectiveChapters.length + 1}`,
        sourceType: trimmed.startsWith('/samples/') ? 'sample' : 'url',
        audioUrl: norm.playableUrl,
        originalUrl: norm.originalUrl || trimmed,
        durationSec: check.durationSec,
      };

      const nextChapters = [...effectiveChapters, newChapter];
      await onUpdateStory(story.id, {
        chapters: nextChapters,
      });
      if (isLocked && adminVault) {
        setAdminVault({...adminVault, chapters: nextChapters});
      }
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
    if (effectiveChapters.length <= 1) {
      setStatusError('Truyện cần giữ lại ít nhất 1 chương.');
      return;
    }
    const nextChapters = effectiveChapters.filter((c) => c.id !== chapterId);
    await onUpdateStory(story.id, {
      chapters: nextChapters,
    });
    if (isLocked && adminVault) {
      setAdminVault({...adminVault, chapters: nextChapters});
    }
  };

  const startEditChapter = (ch: AudioChapter) => {
    setEditingChapterId(ch.id);
    setEditChTitle(ch.title);
    setEditChUrl(ch.originalUrl || ch.audioUrl);
    setStatusError(null);
  };

  const handleSaveEditChapter = async (e: React.FormEvent, originalChapter: AudioChapter) => {
    e.preventDefault();
    const trimmed = editChUrl.trim();
    const driveId = extractGoogleDriveFileId(trimmed);
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/samples/') && !driveId) {
      setStatusError('Vui lòng nhập link hợp lệ (https://...) hoặc File ID Google Drive sau /d/.');
      return;
    }

    setIsBusy(true);
    setStatusError(null);
    try {
      const norm = normalizeExternalAudioUrl(trimmed);
      const isSameSource =
        norm.playableUrl === originalChapter.audioUrl ||
        trimmed === (originalChapter.originalUrl || originalChapter.audioUrl);

      let durationSec = originalChapter.durationSec;
      if (!isSameSource || durationSec <= 0) {
        const streamUrl = resolvePlayableAudioUrl(norm.playableUrl);
        const check = await getAudioDurationFromUrl(streamUrl);
        if (check.durationSec > 0) {
          durationSec = check.durationSec;
        } else if (!isSameSource) {
          durationSec = 0;
        }
        if (norm.isGoogleDrive && !check.ok && norm.driveFileId) {
          const hint = await diagnoseGoogleDriveFile(norm.driveFileId);
          if (hint) {
            setStatusError(hint);
          }
        }
      }

      const updatedChapters = effectiveChapters.map((c) =>
        c.id === originalChapter.id
          ? {
              ...c,
              title: editChTitle.trim() || c.title,
              sourceType: trimmed.startsWith('/samples/') ? ('sample' as const) : ('url' as const),
              audioUrl: norm.playableUrl,
              originalUrl: norm.originalUrl || trimmed,
              durationSec,
            }
          : c
      );

      await onUpdateStory(story.id, {chapters: updatedChapters});
      if (isLocked && adminVault) {
        setAdminVault({...adminVault, chapters: updatedChapters});
      }
      setEditingChapterId(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Không thể cập nhật link chương.');
    } finally {
      setIsBusy(false);
    }
  };

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
        <div className="flex items-center justify-between gap-2 border-b border-[#DEC999] px-6 py-4 dark:border-[#2E294D]">
          <span className="text-xs font-medium text-[#6D5937] dark:text-[#ACA4CA]">
            {story.category} · {displayChapterCount} chương
            {totalDuration > 0 ? ` · ${formatDuration(totalDuration)}` : ''}
            {canManage && !story.isPublished ? ' · Bản nháp' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            {isLocked && (
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5C492B] dark:text-[#ACA4CA]"
                title={canManage ? 'Truyện đang khoá mật khẩu' : isUnlocked ? 'Đã mở khoá' : 'Truyện có mật khẩu'}
                aria-label={canManage ? 'Truyện đang khoá mật khẩu' : isUnlocked ? 'Đã mở khoá' : 'Truyện có mật khẩu'}
              >
                {hasAccess ? (
                  <LockOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                )}
              </span>
            )}
            <button
              type="button"
              onClick={handleShareStory}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                copiedLink
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'text-[#4B3B21] hover:bg-[#EFE0BA] dark:text-[#DCD6F0] dark:hover:bg-[#292447]'
              }`}
              title="Sao chép link riêng của truyện này để chia sẻ"
              aria-label="Chia sẻ link truyện"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Đã chép link</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Chia sẻ</span>
                </>
              )}
            </button>
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
                  disabled={isLoadingVault && !isEditing}
                  onClick={() => (isEditing ? setIsEditing(false) : startEdit())}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] disabled:opacity-50 dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
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
                    Link ảnh bìa (Hỗ trợ link share Google Drive — tự chuyển đổi & tối ưu độ nét)
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {editCoverUrl.trim() && (
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-[#DEC999] bg-[#EFE0BA] dark:border-[#37315A] dark:bg-[#262240]">
                        <CoverImage src={editCoverUrl} alt="Xem trước bìa" targetWidth={128} />
                      </div>
                    )}
                    <input
                      type="text"
                      maxLength={1000}
                      value={editCoverUrl}
                      onChange={(e) => setEditCoverUrl(e.target.value)}
                      onBlur={(e) => {
                        const converted = normalizeCoverImageUrl(e.target.value);
                        if (converted !== e.target.value) {
                          setEditCoverUrl(converted);
                        }
                      }}
                      placeholder="Dán link ảnh hoặc link Google Drive..."
                      className="min-w-[200px] flex-1 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                    />
                    {supabaseConfigured && (
                      <>
                        <input
                          ref={editCoverFileRef}
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setIsUploadingCover(true);
                            setStatusError(null);
                            try {
                              const optimized = await optimizeCoverImageFile(file, 600, 800);
                              const uploadedUrl = await uploadCoverToSupabase(optimized.blob, {
                                filename: optimized.filename,
                                storyFolder: 'covers',
                              });
                              setEditCoverUrl(uploadedUrl);
                            } catch (err) {
                              setStatusError(
                                err instanceof Error
                                  ? err.message
                                  : 'Không thể tối ưu và tải ảnh bìa lên.'
                              );
                            } finally {
                              setIsUploadingCover(false);
                              if (editCoverFileRef.current) editCoverFileRef.current.value = '';
                            }
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isUploadingCover}
                          onClick={() => editCoverFileRef.current?.click()}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] disabled:opacity-60 dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#DCD6F0] dark:hover:bg-[#2D284D]"
                        >
                          {isUploadingCover ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          <span>{isUploadingCover ? 'Đang nén...' : 'Tải ảnh'}</span>
                        </button>
                      </>
                    )}
                  </div>
                  {extractGoogleDriveFileId(editCoverUrl) && (
                    <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                      Link hiển thị:{' '}
                      <span className="font-mono-tabular break-all">
                        {normalizeCoverImageUrl(editCoverUrl)}
                      </span>
                    </p>
                  )}
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

                {/* Story Password Lock Section */}
                <div className="sm:col-span-2 rounded-xl border border-[#DEC999] bg-[#F7ECCE]/60 p-3.5 dark:border-[#37315A] dark:bg-[#19162D]">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                    <input
                      type="checkbox"
                      checked={editIsLocked}
                      onChange={(e) => setEditIsLocked(e.target.checked)}
                      className="h-4 w-4 accent-[#7A4B0C] dark:accent-[#6A58C8]"
                    />
                    <Lock className="h-3.5 w-3.5 text-[#7A4B0C] dark:text-[#D5B263]" />
                    <span>Khoá truyện bằng mật khẩu riêng</span>
                  </label>
                  <p className="mt-1 text-[11px] text-[#5C492B] dark:text-[#ACA4CA]">
                    Bất kỳ người nghe nào (kể cả khi mở link chia sẻ trực tiếp) đều phải nhập đúng mật khẩu mới xem được mô tả, danh sách chương và phát audio.
                  </p>

                  {editIsLocked && (
                    <div className="mt-2.5">
                      <label className="mb-1 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                        Mật khẩu mở truyện *
                      </label>
                      <div className="relative">
                        <input
                          type={showEditLockPassword ? 'text' : 'password'}
                          required={editIsLocked}
                          maxLength={100}
                          value={editLockPassword}
                          onChange={(e) => setEditLockPassword(e.target.value)}
                          placeholder="Nhập mật khẩu bảo vệ truyện..."
                          className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] py-2 pr-10 pl-3 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditLockPassword((v) => !v)}
                          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-[#6D5937] hover:text-[#2B2111] dark:text-[#9E94C0] dark:hover:text-[#F1ECF8]"
                          aria-label={showEditLockPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showEditLockPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A4B0C] px-4 py-2 text-xs font-medium text-white hover:bg-[#5E3807] disabled:opacity-60 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="h-48 w-36 shrink-0 overflow-hidden rounded-xl border border-[#DEC999] bg-[#EFE0BA] dark:border-[#322C52] dark:bg-[#231F3D]">
                <CoverImage
                  src={story.coverUrl}
                  alt={story.title}
                  targetWidth={480}
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

                {hasAccess ? (
                  <>
                    {canManage && isLocked && isLoadingVault ? (
                      <div className="inline-flex items-center gap-2 text-xs text-[#6D5937] dark:text-[#9E94C0]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang tải nội dung bảo mật...</span>
                      </div>
                    ) : (
                      effectiveDescription && (
                        <p className="text-sm leading-relaxed text-[#4B3B21] dark:text-[#CFC8E6]">
                          {effectiveDescription}
                        </p>
                      )
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
                    {effectiveChapters.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onPlayChapter(
                              effectiveStory,
                              Math.min(
                                listenerState.lastChapterIndex || 0,
                                Math.max(0, effectiveChapters.length - 1)
                              )
                            )
                          }
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#7A4B0C] px-4 py-2 text-sm font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                        >
                          <Play className="h-4 w-4 fill-current" />
                          <span>
                            {listenerState.lastPositionSec > 5 ? 'Nghe tiếp vị trí đang dở' : 'Phát từ đầu'}
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#5C492B] dark:text-[#ACA4CA]">
                    Nội dung giới thiệu và danh sách {displayChapterCount} chương đang được ẩn sau mật khẩu.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Unlock Gate OR Chapters List */}
          {!hasAccess ? (
            <form
              onSubmit={handleUnlockSubmit}
              className="space-y-4 rounded-2xl border border-[#DEC999] bg-[#F7ECCE]/75 p-5 dark:border-[#37315A] dark:bg-[#19162D]"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFE0BA] text-[#7A4B0C] dark:bg-[#292447] dark:text-[#D5B263]">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                    Truyện này được bảo vệ bằng mật khẩu
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#5C492B] dark:text-[#ACA4CA]">
                    Vui lòng nhập mật khẩu do quản trị viên cung cấp để mở khoá phần mô tả, danh sách chương và nghe audio.
                  </p>
                </div>
              </div>

              {unlockError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                  {unlockError}
                </div>
              )}

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="relative flex-1">
                  <input
                    type={showUnlockPassword ? 'text' : 'password'}
                    autoFocus
                    required
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mở khoá..."
                    className="h-11 w-full rounded-xl border border-[#D3BC87] bg-[#FFFDF6] pr-10 pl-3.5 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword((v) => !v)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-[#6D5937] hover:text-[#2B2111] dark:text-[#9E94C0] dark:hover:text-[#F1ECF8]"
                    aria-label={showUnlockPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showUnlockPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#7A4B0C] px-5 text-sm font-medium text-white hover:bg-[#5E3807] disabled:opacity-60 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                >
                  {isUnlocking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockOpen className="h-4 w-4" />
                  )}
                  <span>{autoPlayOnUnlock ? 'Mở khoá & Nghe ngay' : 'Mở khoá truyện'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="border-t border-[#DEC999] pt-5 dark:border-[#2E294D]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                  Danh sách chương ({effectiveChapters.length})
                </h3>
                {canManage && (
                  <button
                    type="button"
                    disabled={isLoadingVault}
                    onClick={() => setIsAddingLink((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D3BC87] px-2.5 py-1.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] disabled:opacity-50 dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
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
                    type="text"
                    required
                    value={newChUrl}
                    onChange={(e) => setNewChUrl(e.target.value)}
                    placeholder="Link audio hoặc ID Google Drive sau /d/..."
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

              {canManage && isLocked && isLoadingVault ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-[#DEC999] bg-[#FFFDF6]/70 px-4 py-8 text-xs text-[#6D5937] dark:border-[#302B4F] dark:bg-[#19162D]/60 dark:text-[#9E94C0]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang tải danh sách chương...</span>
                </div>
              ) : (
                <div className="divide-y divide-[#ECDCB4] rounded-xl border border-[#DEC999] bg-[#FFFDF6]/70 dark:divide-[#2E294D] dark:border-[#302B4F] dark:bg-[#19162D]/60">
                  {effectiveChapters.map((ch, idx) => {
                    const isActiveChapter = currentStoryId === story.id && currentChapterIndex === idx;
                    const isEditingThis = canManage && editingChapterId === ch.id;

                    if (isEditingThis) {
                      return (
                        <form
                          key={ch.id}
                          onSubmit={(e) => handleSaveEditChapter(e, ch)}
                          className="space-y-2 bg-[#F7ECCE]/60 px-4 py-3 dark:bg-[#231F3D]/80"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              type="text"
                              required
                              value={editChTitle}
                              onChange={(e) => setEditChTitle(e.target.value)}
                              placeholder="Tên chương..."
                              className="rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-1.5 text-xs text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none sm:w-48 dark:border-[#37315A] dark:bg-[#19162D] dark:text-[#F1ECF8]"
                            />
                            <input
                              type="text"
                              required
                              value={editChUrl}
                              onChange={(e) => setEditChUrl(e.target.value)}
                              placeholder="Link audio hoặc ID Google Drive sau /d/..."
                              className="flex-1 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-1.5 text-xs text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#19162D] dark:text-[#F1ECF8]"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setEditingChapterId(null)}
                              className="rounded-lg border border-[#D3BC87] px-2.5 py-1 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                            >
                              Huỷ
                            </button>
                            <button
                              type="submit"
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#7A4B0C] px-3 py-1 text-xs font-medium text-white hover:bg-[#5E3807] disabled:opacity-60 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                            >
                              {isBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              <span>Lưu chương</span>
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={ch.id}
                        className={`flex items-center justify-between gap-3 px-4 py-3 ${
                          isActiveChapter ? 'bg-[#EFE0BA]/75 dark:bg-[#292447]/80' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onPlayChapter(effectiveStory, idx)}
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

                        {canManage && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditChapter(ch)}
                              className="rounded p-1.5 text-[#856F4B] hover:bg-[#EFE0BA] hover:text-[#7A4B0C] dark:text-[#9E94C0] dark:hover:bg-[#292447] dark:hover:text-[#D5B263]"
                              title="Chỉnh sửa tên & link chương"
                              aria-label="Chỉnh sửa chương"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            {effectiveChapters.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveChapter(ch.id)}
                                className="rounded p-1.5 text-[#856F4B] hover:bg-[#EFE0BA] hover:text-rose-600 dark:text-[#9E94C0] dark:hover:bg-[#292447]"
                                title="Xoá chương"
                                aria-label="Xoá chương"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
              {hasAccess
                ? 'Bấm vào tên chương bất kỳ để bắt đầu nghe'
                : 'Nhập mật khẩu để mở khoá truyện'}
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
