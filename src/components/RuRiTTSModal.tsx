import {Check, Code2, Copy, ExternalLink, Mic, X} from 'lucide-react';
import {useMemo, useState} from 'react';
import {RURITTS_APP_URL} from '../utils/ruriTtsBridge';

interface RuRiTTSModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RuRiTTSModal({isOpen, onClose}: RuRiTTSModalProps) {
  const [showIntegrationSnippet, setShowIntegrationSnippet] = useState(false);
  const [copied, setCopied] = useState(false);

  const iframeSrc = useMemo(() => {
    if (typeof window === 'undefined') return RURITTS_APP_URL;
    const url = new URL(RURITTS_APP_URL);
    url.searchParams.set('source', 'tusach');
    url.searchParams.set('origin', window.location.origin);
    return url.toString();
  }, []);

  if (!isOpen) return null;

  const snippet = `// Đặt trong repo RuRiTTS khi bấm nút "Gửi sang Tủ sách":
const target = window.opener || (window.parent !== window ? window.parent : null);
if (target) {
  target.postMessage({
    type: 'RURITTS_EXPORT_STORY',
    payload: {
      title: storyTitle,
      author: authorName,
      narrator: voiceName,
      chapters: [
        { title: 'Chương 1', filename: 'chuong-1.mp3', fileBlob: mp3Blob, durationSec: 180 }
      ]
    }
  }, '*');
}`;

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ruritts-modal-title"
    >
      <div
        className="fixed inset-0 bg-[#1B1408]/60 backdrop-blur-xs dark:bg-[#0B0917]/75"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#DEC999] bg-[#FDF8EB] shadow-2xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DEC999] px-5 py-3.5 dark:border-[#2E294D]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7A4B0C]/15 text-[#7A4B0C] dark:bg-[#6A58C8]/25 dark:text-[#D5B263]">
              <Mic className="h-4 w-4" />
            </span>
            <div>
              <h2
                id="ruritts-modal-title"
                className="font-display text-base font-semibold text-[#2B2111] sm:text-lg dark:text-[#F4EFFB]"
              >
                Phòng thu RuRiTTS — Tạo sách nói từ văn bản
              </h2>
              <p className="text-xs text-[#6D5937] dark:text-[#ACA4CA]">
                Đang sẵn sàng nhận dữ liệu tự động qua <code className="font-mono-tabular">postMessage</code> (hoặc tải MP3 về rồi thả vào mục Thêm truyện)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIntegrationSnippet((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-2.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#DCD6F0] dark:hover:bg-[#2D284D]"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Mã nối RuRiTTS</span>
            </button>
            <a
              href={iframeSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-2.5 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#DCD6F0] dark:hover:bg-[#2D284D]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Mở tab mới</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
              aria-label="Đóng RuRiTTS"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {showIntegrationSnippet && (
          <div className="border-b border-[#DEC999] bg-[#F7ECCE]/80 px-5 py-3 text-xs dark:border-[#2E294D] dark:bg-[#19162D]">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                Đoạn mã gắn vào nút “Gửi sang Tủ sách” trong repo RuRiTTS:
              </span>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1 rounded-md bg-[#7A4B0C] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8]"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Đã chép' : 'Sao chép mã'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[#DEC999] bg-[#FFFDF6] p-2.5 font-mono-tabular text-[11px] leading-relaxed text-[#2B2111] dark:border-[#322C52] dark:bg-[#141224] dark:text-[#DCD6F0]">
              {snippet}
            </pre>
          </div>
        )}

        {/* Embedded RuRiTTS Iframe */}
        <div className="relative flex-1 bg-white dark:bg-[#141224]">
          <iframe
            src={iframeSrc}
            title="Công cụ chuyển văn bản thành lời nói RuRiTTS"
            className="h-full w-full border-0"
            allow="clipboard-write; microphone"
          />
        </div>
      </div>
    </div>
  );
}
