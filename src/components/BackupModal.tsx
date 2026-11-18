import {CheckCircle2, Cloud, Download, Loader2, Sparkles, Upload, X} from 'lucide-react';
import {useRef, useState} from 'react';
import {createCategoryDoc, createStoryDoc, seedStarterLibrary} from '../firebase';
import type {AudioChapter, AudioStory, CategoryDoc, LibraryStats} from '../types';

interface BackupModalProps {
  isOpen: boolean;
  adminUid: string;
  stories: AudioStory[];
  categories: CategoryDoc[];
  stats: LibraryStats;
  onClose: () => void;
}

export function BackupModal({
  isOpen,
  adminUid,
  stories,
  categories,
  stats,
  onClose,
}: BackupModalProps) {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      categories: categories.map((c) => c.name),
      stories: stories.map((s) => ({
        id: s.id,
        title: s.title,
        author: s.author,
        narrator: s.narrator,
        category: s.category,
        keywords: s.keywords,
        description: s.description,
        coverUrl: s.coverUrl,
        chapters: s.chapters,
        isPublished: s.isPublished,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tu-sach-ru-ri-ru-ri-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setIsBusy(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        categories?: string[];
        stories?: Array<{
          id?: string;
          title: string;
          author?: string;
          narrator?: string;
          category?: string;
          keywords?: string[];
          description?: string;
          coverUrl?: string;
          chapters: AudioChapter[];
          isPublished?: boolean;
        }>;
      };

      if (!parsed || !Array.isArray(parsed.stories)) {
        throw new Error('File sao lưu JSON không đúng định dạng.');
      }

      if (Array.isArray(parsed.categories)) {
        for (const catName of parsed.categories) {
          if (typeof catName === 'string' && catName.trim()) {
            await createCategoryDoc(catName.trim(), adminUid);
          }
        }
      }

      const existingIds = new Set(stories.map((s) => s.id));
      let addedCount = 0;

      for (const s of parsed.stories) {
        if (!s.title || !Array.isArray(s.chapters) || s.chapters.length === 0) continue;
        if (s.id && existingIds.has(s.id)) continue;
        await createStoryDoc(
          {
            id: s.id,
            title: s.title,
            author: s.author || 'Chưa rõ tác giả',
            narrator: s.narrator || 'Chưa rõ giọng đọc',
            category: s.category || 'Truyện ngắn',
            keywords: Array.isArray(s.keywords) ? s.keywords : [],
            description: s.description || '',
            coverUrl: s.coverUrl || '/src/assets/images/cover_novel_rain_1794949188336.jpg',
            chapters: s.chapters,
            isPublished: s.isPublished !== false,
          },
          adminUid
        );
        addedCount++;
      }

      setStatusMsg(`Đã nhập thêm ${addedCount} truyện vào Firebase Firestore.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi khôi phục file JSON.');
    } finally {
      setIsBusy(false);
      e.target.value = '';
    }
  };

  const handleSeedStarters = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsBusy(true);
    try {
      const added = await seedStarterLibrary(adminUid);
      setStatusMsg(
        added > 0
          ? `Đã khởi tạo ${added} bộ truyện mẫu và danh mục phân loại vào Firestore.`
          : 'Thư viện đã có dữ liệu sẵn.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể khởi tạo dữ liệu mẫu.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div
        className="fixed inset-0 bg-[#1B1408]/50 backdrop-blur-xs dark:bg-[#0B0917]/70"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[#DEC999] bg-[#FDF8EB] shadow-2xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
        <div className="flex items-center justify-between border-b border-[#DEC999] px-6 py-4 dark:border-[#2E294D]">
          <h2
            id="backup-modal-title"
            className="font-display text-lg font-semibold text-[#2B2111] dark:text-[#F4EFFB]"
          >
            Sao lưu & Lưu trữ đám mây (Firebase)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {statusMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="rounded-xl border border-[#DEC999] bg-[#F7ECCE]/75 p-4 dark:border-[#302B4F] dark:bg-[#19162D]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
              <Cloud className="h-4 w-4 text-[#7A4B0C] dark:text-[#D5B263]" />
              <span>Kiến trúc Deploy miễn phí 100%</span>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-[#5C492B] dark:text-[#ACA4CA]">
              <li>
                1. <strong>Danh mục & Phân quyền:</strong> Đã lưu vĩnh viễn trên Firebase Firestore & bảo vệ bằng Google Auth.
              </li>
              <li>
                2. <strong>File Audio nặng:</strong> Nên lưu trên <strong>Cloudflare R2</strong> (10GB miễn phí, không giới hạn băng thông) hoặc <strong>Archive.org</strong> (không giới hạn dung lượng) rồi dán link vào mục Thêm truyện.
              </li>
              <li>
                3. <strong>Deploy giao diện:</strong> Có thể build tĩnh (`npm run build`) và deploy miễn phí lên <strong>Vercel</strong>, <strong>Netlify</strong> hoặc <strong>GitHub Pages</strong>.
              </li>
            </ul>
            <p className="mt-3 font-mono-tabular text-xs text-[#6D5937] dark:text-[#9E94C0]">
              Đang lưu trên Firestore: {stats.totalStories} truyện · {stats.totalChapters} chương
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#7A4B0C] px-4 py-2 text-xs font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
            >
              <Download className="h-4 w-4" />
              <span>Tải bản sao lưu (.json)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-4 py-2 text-xs font-medium text-[#3B2E17] hover:bg-[#EFE0BA] disabled:opacity-60 dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#DCD6F0] dark:hover:bg-[#2D284D]"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>Nhập từ file JSON</span>
            </button>
          </div>

          {stories.length === 0 && (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSeedStarters}
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#D3BC87] px-4 py-2 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA]/60 dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#231F3D]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Khởi tạo 4 bộ truyện mẫu để thử nghiệm</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
