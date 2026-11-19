import {
  AlertCircle,
  Check,
  CheckCircle2,
  CloudUpload,
  Edit3,
  HelpCircle,
  Link2,
  Loader2,
  Mic,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {createCategoryDoc, createStoryDoc} from '../firebase';
import type {AudioChapter, CategoryDoc} from '../types';
import {
  CURATED_COVERS,
  diagnoseGoogleDriveFile,
  extractGoogleDriveFileId,
  formatDuration,
  getAudioDurationFromUrl,
  normalizeExternalAudioUrl,
  resolvePlayableAudioUrl,
} from '../utils/format';
import type {RuRiTTSImportedDraft, RuRiTTSPendingFile} from '../utils/ruriTtsBridge';
import {
  checkSupabaseStorageStatus,
  getAudioDurationFromBlob,
  type SupabaseStorageStatus,
  uploadAudioToSupabase,
} from '../utils/supabaseUpload';

type AudioInputMode = 'supabase' | 'single_link' | 'batch_links';

interface QueuedAudioFile extends RuRiTTSPendingFile {
  progress: number;
  status: 'idle' | 'uploading' | 'error';
  errorMsg?: string;
}

interface AddStoryModalProps {
  isOpen: boolean;
  adminUid: string;
  categories: CategoryDoc[];
  existingKeywords: string[];
  importedDraft?: RuRiTTSImportedDraft | null;
  onClearDraft?: () => void;
  onOpenRuRiTTS?: () => void;
  onClose: () => void;
  onCreated: () => void;
}

export function AddStoryModal({
  isOpen,
  adminUid,
  categories,
  existingKeywords,
  importedDraft,
  onClearDraft,
  onOpenRuRiTTS,
  onClose,
  onCreated,
}: AddStoryModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [narrator, setNarrator] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Tiểu thuyết');
  const [customCategory, setCustomCategory] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState(CURATED_COVERS[0].url);
  const [customCoverUrl, setCustomCoverUrl] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const [chapters, setChapters] = useState<AudioChapter[]>([]);
  const [audioInputMode, setAudioInputMode] = useState<AudioInputMode>('supabase');
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [batchLinksInput, setBatchLinksInput] = useState('');
  const [isCheckingLink, setIsCheckingLink] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{ok: boolean; message: string} | null>(null);
  const [showHostHelp, setShowHostHelp] = useState(false);

  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStorageStatus | null>(null);
  const [pendingFiles, setPendingFiles] = useState<QueuedAudioFile[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterUrl, setEditChapterUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    checkSupabaseStorageStatus().then((status) => {
      if (active) setSupabaseStatus(status);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !importedDraft) return;

    if (importedDraft.title) setTitle(importedDraft.title);
    if (importedDraft.author) setAuthor(importedDraft.author);
    if (importedDraft.narrator) setNarrator(importedDraft.narrator);
    if (importedDraft.description) setDescription(importedDraft.description);
    if (importedDraft.keywords && importedDraft.keywords.length > 0) {
      setKeywordsInput(importedDraft.keywords.join(', '));
    }
    if (importedDraft.category) {
      const exists = categories.some((c) => c.name === importedDraft.category);
      if (exists) {
        setCategory(importedDraft.category);
        setCustomCategory('');
      } else {
        setCategory('__custom__');
        setCustomCategory(importedDraft.category);
      }
    }

    if (importedDraft.readyUrls.length > 0) {
      const readyChapters: AudioChapter[] = importedDraft.readyUrls.map((item) => {
        const norm = normalizeExternalAudioUrl(item.audioUrl);
        return {
          id: `ch-${crypto.randomUUID()}`,
          title: item.title,
          sourceType: 'url',
          audioUrl: norm.playableUrl,
          originalUrl: item.audioUrl,
          durationSec: item.durationSec,
        };
      });
      setChapters((prev) => [...prev, ...readyChapters]);
    }

    if (importedDraft.pendingFiles.length > 0) {
      setAudioInputMode('supabase');
      const queued: QueuedAudioFile[] = importedDraft.pendingFiles.map((pf) => ({
        ...pf,
        progress: 0,
        status: 'idle',
      }));
      setPendingFiles((prev) => [...prev, ...queued]);

      queued.forEach((item) => {
        if (item.durationSec <= 0) {
          getAudioDurationFromBlob(item.blob).then((dur) => {
            if (dur > 0) {
              setPendingFiles((prev) =>
                prev.map((q) => (q.id === item.id ? {...q, durationSec: dur} : q))
              );
            }
          });
        }
      });
    }

    const parts: string[] = [];
    if (importedDraft.pendingFiles.length > 0) {
      parts.push(`${importedDraft.pendingFiles.length} file audio chờ tải lên Supabase`);
    }
    if (importedDraft.readyUrls.length > 0) {
      parts.push(`${importedDraft.readyUrls.length} chương đã gắn link`);
    }
    setLinkStatus({
      ok: true,
      message:
        parts.length > 0
          ? `Đã nhận dữ liệu từ RuRiTTS (${parts.join(', ')}).`
          : 'Đã nhận thông tin truyện từ RuRiTTS.',
    });
    setErrorMsg(null);
    onClearDraft?.();
  }, [isOpen, importedDraft, categories, onClearDraft]);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setNarrator('');
    setCategory(categories[0]?.name || 'Tiểu thuyết');
    setCustomCategory('');
    setKeywordsInput('');
    setDescription('');
    setCoverUrl(CURATED_COVERS[0].url);
    setCustomCoverUrl('');
    setIsPublished(true);
    setChapters([]);
    setPendingFiles([]);
    setEditingChapterId(null);
    setEditChapterUrl('');
    setLinkUrlInput('');
    setLinkTitleInput('');
    setBatchLinksInput('');
    setLinkStatus(null);
    setErrorMsg(null);
    onClearDraft?.();
  };

  const handleClose = () => {
    if (isSubmitting || isUploadingFiles) return;
    resetForm();
    onClose();
  };

  const handlePickLocalFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);

    const files = Array.from(fileList);
    const startIdx = chapters.length + pendingFiles.length;
    const added: QueuedAudioFile[] = files.map((file, idx) => {
      const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
      return {
        id: `local-${crypto.randomUUID()}`,
        title: baseName || `Chương ${startIdx + idx + 1}`,
        filename: file.name,
        blob: file,
        durationSec: 0,
        progress: 0,
        status: 'idle',
      };
    });

    setPendingFiles((prev) => [...prev, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    added.forEach((item) => {
      getAudioDurationFromBlob(item.blob).then((dur) => {
        if (dur > 0) {
          setPendingFiles((prev) =>
            prev.map((q) => (q.id === item.id ? {...q, durationSec: dur} : q))
          );
        }
      });
    });
  };

  const handleUploadAllToSupabase = async () => {
    if (pendingFiles.length === 0 || isUploadingFiles) return;
    setErrorMsg(null);
    setLinkStatus(null);
    setIsUploadingFiles(true);

    let successCount = 0;
    let firstError: string | null = null;
    const snapshot = [...pendingFiles];

    for (const item of snapshot) {
      setPendingFiles((prev) =>
        prev.map((q) =>
          q.id === item.id ? {...q, status: 'uploading', progress: 0, errorMsg: undefined} : q
        )
      );

      try {
        const uploaded = await uploadAudioToSupabase(item.blob, {
          filename: item.filename,
          storyFolder: title.trim() || 'library',
          onProgress: (percent) => {
            setPendingFiles((prev) =>
              prev.map((q) => (q.id === item.id ? {...q, progress: percent} : q))
            );
          },
        });

        const newChapter: AudioChapter = {
          id: `ch-${crypto.randomUUID()}`,
          title: item.title.trim() || `Chương ${chapters.length + successCount + 1}`,
          sourceType: 'url',
          audioUrl: uploaded.publicUrl,
          originalUrl: uploaded.publicUrl,
          sizeBytes: uploaded.sizeBytes,
          mimeType: uploaded.mimeType,
          durationSec: item.durationSec,
        };

        setChapters((prev) => [...prev, newChapter]);
        setPendingFiles((prev) => prev.filter((q) => q.id !== item.id));
        successCount += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Tải lên Supabase thất bại.';
        if (!firstError) firstError = msg;
        setPendingFiles((prev) =>
          prev.map((q) => (q.id === item.id ? {...q, status: 'error', errorMsg: msg} : q))
        );
      }
    }

    setIsUploadingFiles(false);

    if (firstError) {
      setErrorMsg(firstError);
    }
    if (successCount > 0) {
      setLinkStatus({
        ok: true,
        message: `Đã tải ${successCount} chương lên Supabase Storage và gắn vào danh sách chương.`,
      });
    }
  };

  const handleVerifyAndAddLink = async () => {
    const trimmed = linkUrlInput.trim();
    const driveId = extractGoogleDriveFileId(trimmed);
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/samples/') && !driveId) {
      setErrorMsg(
        'Vui lòng nhập đường dẫn hợp lệ (https://...) hoặc dán trực tiếp File ID Google Drive sau /d/.'
      );
      return;
    }

    setErrorMsg(null);
    setLinkStatus(null);
    setIsCheckingLink(true);

    try {
      const normalized = normalizeExternalAudioUrl(trimmed);
      const streamUrl = resolvePlayableAudioUrl(normalized.playableUrl);
      const check = await getAudioDurationFromUrl(streamUrl);

      const newChapter: AudioChapter = {
        id: `ch-${crypto.randomUUID()}`,
        title: linkTitleInput.trim() || `Chương ${chapters.length + 1}`,
        sourceType: trimmed.startsWith('/samples/') ? 'sample' : 'url',
        audioUrl: normalized.playableUrl,
        originalUrl: normalized.originalUrl || trimmed,
        durationSec: check.durationSec,
      };

      setChapters((prev) => [...prev, newChapter]);
      if (!title.trim() && linkTitleInput.trim()) {
        setTitle(linkTitleInput.trim());
      }
      setLinkUrlInput('');
      setLinkTitleInput('');

      if (normalized.isGoogleDrive && !check.ok) {
        const hint = normalized.driveFileId
          ? await diagnoseGoogleDriveFile(normalized.driveFileId)
          : null;
        setLinkStatus({
          ok: true,
          message:
            hint ||
            'Đã thêm link Google Drive (chưa đo được sẵn thời lượng — hãy kiểm tra bật Google Drive API và quyền chia sẻ Công khai).',
        });
      } else {
        setLinkStatus({
          ok: true,
          message: `Đã thêm liên kết (${normalized.providerLabel}${
            check.durationSec > 0 ? ` · ${formatDuration(check.durationSec)}` : ''
          }).`,
        });
      }
    } finally {
      setIsCheckingLink(false);
    }
  };

  const handleAddBatchLinks = () => {
    const lines = batchLinksInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//i.test(l) || Boolean(extractGoogleDriveFileId(l)));

    if (lines.length === 0) {
      setErrorMsg(
        'Vui lòng nhập ít nhất 1 link bắt đầu bằng http://, https:// hoặc ID Google Drive sau /d/.'
      );
      return;
    }

    const added: AudioChapter[] = lines.map((line, idx) => {
      const norm = normalizeExternalAudioUrl(line);
      return {
        id: `ch-${crypto.randomUUID()}`,
        title: `Chương ${chapters.length + idx + 1}`,
        sourceType: 'url',
        audioUrl: norm.playableUrl,
        originalUrl: norm.originalUrl || line,
        durationSec: 0,
      };
    });

    setChapters((prev) => [...prev, ...added]);
    setBatchLinksInput('');
    setErrorMsg(null);
    setLinkStatus({ok: true, message: `Đã thêm ${added.length} chương từ danh sách link.`});
  };

  const handleSaveStagedChapterUrl = async (chapterId: string) => {
    const trimmed = editChapterUrl.trim();
    const driveId = extractGoogleDriveFileId(trimmed);
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/samples/') && !driveId) {
      setErrorMsg('Vui lòng nhập link hợp lệ (https://...) hoặc File ID Google Drive sau /d/.');
      return;
    }
    const norm = normalizeExternalAudioUrl(trimmed);
    const streamUrl = resolvePlayableAudioUrl(norm.playableUrl);
    const check = await getAudioDurationFromUrl(streamUrl);
    setChapters((prev) =>
      prev.map((item) =>
        item.id === chapterId
          ? {
              ...item,
              sourceType: trimmed.startsWith('/samples/') ? 'sample' : 'url',
              audioUrl: norm.playableUrl,
              originalUrl: norm.originalUrl || trimmed,
              durationSec: check.durationSec > 0 ? check.durationSec : item.durationSec,
            }
          : item
      )
    );
    setEditingChapterId(null);
    setErrorMsg(null);
  };

  const handleAppendKeyword = (kw: string) => {
    const current = keywordsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(kw)) {
      setKeywordsInput([...current, kw].join(', '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tên truyện.');
      return;
    }
    if (pendingFiles.length > 0) {
      setErrorMsg(
        'Bạn còn file audio trong hàng đợi chưa tải lên Supabase Storage. Hãy bấm "Tải lên Supabase Storage" hoặc xoá khỏi hàng đợi trước khi lưu.'
      );
      return;
    }
    if (chapters.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất 1 chương audio (tải file lên Supabase hoặc dán link).');
      return;
    }

    const finalCategory =
      category === '__custom__' ? customCategory.trim() || 'Truyện ngắn' : category;

    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const finalCover = customCoverUrl.trim() || coverUrl;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const catExists = categories.some((c) => c.name === finalCategory);
      if (!catExists) {
        await createCategoryDoc(finalCategory, adminUid);
      }

      await createStoryDoc(
        {
          title: title.trim(),
          author: author.trim() || 'Chưa rõ tác giả',
          narrator: narrator.trim() || 'Chưa rõ giọng đọc',
          category: finalCategory,
          keywords,
          description: description.trim(),
          coverUrl: finalCover,
          chapters,
          isPublished,
        },
        adminUid
      );

      onCreated();
      resetForm();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu lên Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-story-heading"
    >
      <div
        className="fixed inset-0 bg-[#1B1408]/50 backdrop-blur-xs dark:bg-[#0B0917]/70"
        onClick={handleClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DEC999] bg-[#FDF8EB] shadow-2xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
        <div className="flex items-center justify-between border-b border-[#DEC999] px-6 py-4 dark:border-[#2E294D]">
          <div>
            <h2
              id="add-story-heading"
              className="font-display text-xl font-semibold text-[#2B2111] dark:text-[#F4EFFB]"
            >
              Thêm truyện audio mới
            </h2>
            <p className="mt-0.5 text-xs text-[#6D5937] dark:text-[#ACA4CA]">
              Tải audio lên Supabase Storage (hoặc RuRiTTS / link ngoài) & lưu danh mục lên Firestore
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
            aria-label="Đóng cửa sổ"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Audio Source Section */}
          <div className="space-y-3 rounded-xl border border-[#DEC999] bg-[#F7ECCE]/70 p-4 dark:border-[#302B4F] dark:bg-[#19162D]/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-[#DEC999] bg-[#FFFDF6] p-0.5 dark:border-[#322C52] dark:bg-[#231F3D]">
                <button
                  type="button"
                  onClick={() => {
                    setAudioInputMode('supabase');
                    setLinkStatus(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    audioInputMode === 'supabase'
                      ? 'bg-[#7A4B0C] text-white dark:bg-[#6A58C8]'
                      : 'text-[#5C492B] hover:text-[#2B2111] dark:text-[#ACA4CA] dark:hover:text-[#F1ECF8]'
                  }`}
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>Tải file / RuRiTTS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAudioInputMode('single_link');
                    setLinkStatus(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    audioInputMode === 'single_link'
                      ? 'bg-[#7A4B0C] text-white dark:bg-[#6A58C8]'
                      : 'text-[#5C492B] hover:text-[#2B2111] dark:text-[#ACA4CA] dark:hover:text-[#F1ECF8]'
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>1 link</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAudioInputMode('batch_links');
                    setLinkStatus(null);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    audioInputMode === 'batch_links'
                      ? 'bg-[#7A4B0C] text-white dark:bg-[#6A58C8]'
                      : 'text-[#5C492B] hover:text-[#2B2111] dark:text-[#ACA4CA] dark:hover:text-[#F1ECF8]'
                  }`}
                >
                  Nhiều link
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowHostHelp((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-[#5C492B] hover:text-[#2B2111] dark:text-[#ACA4CA] dark:hover:text-[#F1ECF8]"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Nơi chứa file miễn phí</span>
              </button>
            </div>

            {showHostHelp && (
              <div className="rounded-lg border border-[#DEC999] bg-[#FFFDF6] p-3 text-xs leading-relaxed text-[#5C492B] dark:border-[#322C52] dark:bg-[#231F3D] dark:text-[#CFC8E6]">
                <p className="font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                  Gợi ý lưu trữ file audio miễn phí chạy cực mượt:
                </p>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-4">
                  <li>
                    <strong>Supabase Storage (1GB miễn phí, không cần thẻ Visa):</strong> Tải trực tiếp file MP3/M4A hoặc gửi thẳng từ RuRiTTS lên bucket Public (<code className="font-mono-tabular">audiobooks</code>), tua mượt và hỗ trợ CORS đầy đủ.
                  </li>
                  <li>
                    <strong>Internet Archive (<code className="font-mono-tabular">archive.org</code>):</strong> Lưu miễn phí không giới hạn dung lượng, copy link{' '}
                    <code className="font-mono-tabular">.mp3</code> trực tiếp dán vào đây.
                  </li>
                  <li>
                    <strong>Dropbox:</strong> Dán link chia sẻ thông thường, hệ thống tự chuyển sang link stream trực tiếp.
                  </li>
                  <li>
                    <strong>Google Drive (qua Drive API `alt=media`):</strong> Tải file lên Drive → bấm <strong>Chia sẻ</strong> → đổi thành{' '}
                    <strong>Bất kỳ ai có đường liên kết (Người xem)</strong> → dán <strong>nguyên link chia sẻ</strong> hoặc <strong>chỉ dán đoạn ID sau <code className="font-mono-tabular">/d/</code></strong> (vd: <code className="font-mono-tabular">1ABCxyz...</code>) vào ô <strong>1 link</strong> hoặc <strong>Nhiều link</strong>.{' '}
                    <span className="text-[#7A4B0C] dark:text-[#D5B263]">
                      Điều kiện: Bật <strong>Google Drive API</strong> trong Google Cloud Console của project <code className="font-mono-tabular">audiobook-17868</code> để phát trực tiếp ổn định qua trình phát của app.
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {audioInputMode === 'supabase' ? (
              <div className="space-y-3">
                {supabaseStatus && !supabaseStatus.configured && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {supabaseStatus.apiError ? (
                        <>
                          Không kiểm tra được trạng thái Supabase Storage ({supabaseStatus.apiError}). Hãy đảm bảo đã cập nhật bản code mới nhất và Redeploy trên Vercel. Trong lúc chờ, bạn vẫn có thể chọn tab <strong>1 link</strong> hoặc <strong>Nhiều link</strong>.
                        </>
                      ) : (
                        <>
                          Chưa cấu hình biến môi trường Supabase trên server (<code className="font-mono-tabular">SUPABASE_URL</code>,{' '}
                          <code className="font-mono-tabular">SUPABASE_SERVICE_ROLE_KEY</code>). Sau khi thêm biến môi trường vào Vercel / Secrets, bạn có thể tải file thẳng lên bucket{' '}
                          <code className="font-mono-tabular">{supabaseStatus.bucket}</code>. Trong lúc chờ, bạn vẫn có thể chọn tab <strong>1 link</strong> hoặc <strong>Nhiều link</strong>.
                        </>
                      )}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    onChange={(e) => handlePickLocalFiles(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3.5 py-2 text-xs font-medium text-[#2B2111] hover:bg-[#EFE0BA] disabled:opacity-60 dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:hover:bg-[#2D284D]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Chọn file MP3 / M4A / WAV</span>
                  </button>

                  {onOpenRuRiTTS && (
                    <button
                      type="button"
                      disabled={isUploadingFiles}
                      onClick={onOpenRuRiTTS}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#7A4B0C]/40 bg-[#7A4B0C]/10 px-3.5 py-2 text-xs font-medium text-[#7A4B0C] hover:bg-[#7A4B0C]/20 disabled:opacity-60 dark:border-[#8B7AE0]/40 dark:bg-[#6A58C8]/20 dark:text-[#E5DEF9] dark:hover:bg-[#6A58C8]/30"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Mở RuRiTTS tạo audio</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#6D5937] dark:text-[#9E94C0]">
                  Tải trực tiếp từ trình duyệt lên Supabase Storage (hỗ trợ tối đa ~50MB/file ở gói miễn phí, tự đo thời lượng audio).
                </p>

                {pendingFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-[#DEC999] bg-[#FFFDF6] p-3 dark:border-[#322C52] dark:bg-[#231F3D]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                        Hàng đợi tải lên Supabase ({pendingFiles.length} file)
                      </span>
                      <button
                        type="button"
                        disabled={isUploadingFiles || (supabaseStatus !== null && !supabaseStatus.configured)}
                        onClick={handleUploadAllToSupabase}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#7A4B0C] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5E3807] disabled:opacity-50 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                      >
                        {isUploadingFiles ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Đang tải lên...</span>
                          </>
                        ) : (
                          <>
                            <CloudUpload className="h-3.5 w-3.5" />
                            <span>Tải lên Supabase Storage</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {pendingFiles.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-[#DEC999]/80 bg-[#FDF8EB] px-3 py-2 dark:border-[#37315A] dark:bg-[#19162D]"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              disabled={isUploadingFiles}
                              value={item.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPendingFiles((prev) =>
                                  prev.map((q) => (q.id === item.id ? {...q, title: val} : q))
                                );
                              }}
                              className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#2B2111] focus:outline-none dark:text-[#F1ECF8]"
                            />
                            <span className="font-mono-tabular text-[11px] text-[#6D5937] whitespace-nowrap dark:text-[#ACA4CA]">
                              {(item.blob.size / (1024 * 1024)).toFixed(1)} MB
                              {item.durationSec > 0 ? ` · ${formatDuration(item.durationSec)}` : ''}
                            </span>
                            {item.status === 'uploading' && (
                              <span className="font-mono-tabular text-[11px] font-semibold text-[#7A4B0C] dark:text-[#D5B263]">
                                {item.progress}%
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={isUploadingFiles}
                              onClick={() =>
                                setPendingFiles((prev) => prev.filter((q) => q.id !== item.id))
                              }
                              className="rounded p-1 text-[#856F4B] hover:bg-[#EFE0BA] hover:text-rose-600 disabled:opacity-40 dark:text-[#9E94C0] dark:hover:bg-[#2D284D]"
                              aria-label="Xoá khỏi hàng đợi"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {item.status === 'uploading' && (
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E9D7AA] dark:bg-[#2E294D]">
                              <div
                                className="h-full bg-[#7A4B0C] transition-all dark:bg-[#8B7AE0]"
                                style={{width: `${item.progress}%`}}
                              />
                            </div>
                          )}
                          {item.status === 'error' && item.errorMsg && (
                            <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                              {item.errorMsg}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : audioInputMode === 'single_link' ? (
              <div className="space-y-2.5">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <input
                    type="text"
                    value={linkTitleInput}
                    onChange={(e) => setLinkTitleInput(e.target.value)}
                    placeholder="Tên chương (tuỳ chọn)"
                    className="rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-xs text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
                  />
                  <input
                    type="text"
                    value={linkUrlInput}
                    onChange={(e) => setLinkUrlInput(e.target.value)}
                    placeholder="Dán link audio hoặc chỉ cần ID Google Drive sau /d/"
                    className="rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-xs text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none sm:col-span-2 dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[#6D5937] dark:text-[#9E94C0]">
                    Hỗ trợ MP3, M4A, WAV, OGG, hoặc ID Google Drive (sau /d/). Tự động đo thời lượng khi kiểm tra.
                  </p>
                  <button
                    type="button"
                    disabled={isCheckingLink}
                    onClick={handleVerifyAndAddLink}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#2B2111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#4B3B21] disabled:opacity-60 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                  >
                    {isCheckingLink ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <span>Kiểm tra & Thêm</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <textarea
                  rows={4}
                  value={batchLinksInput}
                  onChange={(e) => setBatchLinksInput(e.target.value)}
                  placeholder={`https://xxx.supabase.co/storage/v1/object/public/audiobook/tap-1.mp3\n1ABCxyzDriveFileIdSauDauGachCheoD\nhttps://archive.org/download/.../tap-2.mp3`}
                  className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-xs text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddBatchLinks}
                    className="inline-flex min-h-[36px] items-center rounded-lg bg-[#2B2111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#4B3B21] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                  >
                    Thêm danh sách chương
                  </button>
                </div>
              </div>
            )}

            {linkStatus && (
              <div
                className={`flex items-start gap-2 text-xs ${
                  linkStatus.ok
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {linkStatus.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{linkStatus.message}</span>
              </div>
            )}
          </div>

          {chapters.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#4B3B21] dark:text-[#DCD6F0]">
                Danh sách chương ({chapters.length})
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {chapters.map((ch, idx) => (
                  <div
                    key={ch.id}
                    className="space-y-2 rounded-lg border border-[#DEC999] bg-[#FFFDF6] px-3 py-2 dark:border-[#322C52] dark:bg-[#231F3D]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-xs text-[#856F4B] dark:text-[#9E94C0]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        value={ch.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChapters((prev) =>
                            prev.map((item) => (item.id === ch.id ? {...item, title: val} : item))
                          );
                        }}
                        className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#2B2111] focus:outline-none dark:text-[#F1ECF8]"
                      />
                      {ch.durationSec > 0 && (
                        <span className="font-mono-tabular text-[11px] text-[#6D5937] whitespace-nowrap dark:text-[#ACA4CA]">
                          {formatDuration(ch.durationSec)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (editingChapterId === ch.id) {
                            setEditingChapterId(null);
                          } else {
                            setEditingChapterId(ch.id);
                            setEditChapterUrl(ch.originalUrl || ch.audioUrl);
                          }
                        }}
                        className="rounded p-1 text-[#856F4B] hover:bg-[#EFE0BA] hover:text-[#7A4B0C] dark:text-[#9E94C0] dark:hover:bg-[#2D284D] dark:hover:text-[#D5B263]"
                        title="Sửa link audio chương này"
                        aria-label="Sửa link chương"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChapters((prev) => prev.filter((item) => item.id !== ch.id))}
                        className="rounded p-1 text-[#856F4B] hover:bg-[#EFE0BA] hover:text-rose-600 dark:text-[#9E94C0] dark:hover:bg-[#2D284D]"
                        aria-label="Xoá chương"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {editingChapterId === ch.id && (
                      <div className="flex items-center gap-2 border-t border-[#DEC999]/70 pt-2 dark:border-[#322C52]">
                        <input
                          type="text"
                          value={editChapterUrl}
                          onChange={(e) => setEditChapterUrl(e.target.value)}
                          placeholder="Link audio hoặc ID Google Drive sau /d/..."
                          className="min-w-0 flex-1 rounded-md border border-[#D3BC87] bg-[#FDF8EB] px-2.5 py-1 text-xs text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#19162D] dark:text-[#F1ECF8]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveStagedChapterUrl(ch.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-[#7A4B0C] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8]"
                        >
                          <Check className="h-3 w-3" />
                          <span>Lưu</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Story Metadata */}
          <div className="grid gap-4 border-t border-[#DEC999] pt-5 sm:grid-cols-2 dark:border-[#2E294D]">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                Tên truyện *
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Đắc Nhân Tâm, Truyện Đêm Khuya..."
                className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                Tác giả
              </label>
              <input
                type="text"
                maxLength={150}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Tên tác giả"
                className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                Giọng đọc / Kênh phát
              </label>
              <input
                type="text"
                maxLength={150}
                value={narrator}
                onChange={(e) => setNarrator(e.target.value)}
                placeholder="Tên người đọc"
                className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                Phân loại
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
                <option value="__custom__">+ Tạo phân loại mới...</option>
              </select>
              {category === '__custom__' && (
                <input
                  type="text"
                  maxLength={80}
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Nhập tên phân loại mới"
                  className="mt-2 w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                Từ khoá (cách nhau bởi dấu phẩy)
              </label>
              <input
                type="text"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="ngủ ngon, kiếm hiệp, chữa lành..."
                className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
              />
              {existingKeywords.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {existingKeywords.slice(0, 6).map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => handleAppendKeyword(kw)}
                      className="text-[11px] text-[#6D5937] hover:text-[#7A4B0C] hover:underline dark:text-[#ACA4CA] dark:hover:text-[#D5B263]"
                    >
                      +{kw}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                Ảnh bìa (Chọn mẫu có sẵn hoặc dán link ảnh)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {CURATED_COVERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCoverUrl(c.url);
                      setCustomCoverUrl('');
                    }}
                    className={`relative h-16 w-12 overflow-hidden rounded-lg border-2 transition-all ${
                      !customCoverUrl && coverUrl === c.url
                        ? 'border-[#7A4B0C] ring-2 ring-[#7A4B0C]/30 dark:border-[#8B7AE0] dark:ring-[#8B7AE0]/30'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                    title={c.label}
                  >
                    <img src={c.url} alt={c.label} className="h-full w-full object-cover" />
                  </button>
                ))}
                <input
                  type="url"
                  value={customCoverUrl}
                  onChange={(e) => setCustomCoverUrl(e.target.value)}
                  placeholder="Hoặc dán URL ảnh bìa (https://...)"
                  className="min-w-[200px] flex-1 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-xs text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]">
                Giới thiệu ngắn / Ghi chú
              </label>
              <textarea
                rows={2}
                maxLength={2500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tóm tắt nội dung hoặc ghi chú về bộ truyện..."
                className="w-full rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
              />
            </div>

            <div className="flex items-center gap-2.5 sm:col-span-2">
              <input
                id="publish-toggle"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-[#D3BC87] text-[#7A4B0C] focus:ring-[#7A4B0C] dark:border-[#37315A] dark:text-[#6A58C8]"
              />
              <label
                htmlFor="publish-toggle"
                className="text-xs font-medium text-[#4B3B21] dark:text-[#DCD6F0]"
              >
                Công khai ngay cho người nghe ở trang chủ (bỏ tick để lưu dưới dạng Nháp)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#DEC999] pt-4 dark:border-[#2E294D]">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[40px] rounded-lg border border-[#D3BC87] px-4 py-2 text-sm font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#7A4B0C] px-5 py-2 text-sm font-medium text-white hover:bg-[#5E3807] disabled:opacity-60 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu lên thư viện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
