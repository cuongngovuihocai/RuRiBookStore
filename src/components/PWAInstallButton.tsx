import {Download, Share, Smartphone, X} from 'lucide-react';
import {useState} from 'react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#7A4B0C]/30 bg-[#7A4B0C] px-3 text-xs font-medium text-white whitespace-nowrap shadow-xs transition-colors hover:bg-[#5E3807] dark:border-[#8B7AE0]/30 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
        title="Cài đặt Tủ sách Rủ Rỉ Rù Rì như ứng dụng trên thiết bị"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Cài đặt App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DEC999] bg-[#FDF8EA] px-3 text-xs font-medium text-[#4B3B21] whitespace-nowrap transition-colors hover:bg-[#EFE0BA] dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
          title="Hướng dẫn cài ứng dụng trên iPhone / iPad"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Cài trên iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div
              className="fixed inset-0 bg-[#1B1408]/50 backdrop-blur-xs dark:bg-[#0B0917]/70"
              onClick={() => setShowIOSGuide(false)}
            />
            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[#DEC999] bg-[#FDF8EB] p-6 shadow-2xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-install-title"
                  className="font-display text-lg font-semibold text-[#2B2111] dark:text-[#F4EFFB]"
                >
                  Cài đặt trên iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2.5 text-sm text-[#4B3B21] dark:text-[#CFC8E6]">
                <li className="flex items-start gap-2">
                  <span className="font-mono-tabular font-semibold text-[#7A4B0C] dark:text-[#D5B263]">
                    1.
                  </span>
                  <span>
                    Nhấn vào biểu tượng <Share className="inline h-3.5 w-3.5 align-text-bottom" />{' '}
                    <strong>Chia sẻ (Share)</strong> trên thanh công cụ trình duyệt Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-tabular font-semibold text-[#7A4B0C] dark:text-[#D5B263]">
                    2.
                  </span>
                  <span>
                    Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#7A4B0C] py-2 text-xs font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
