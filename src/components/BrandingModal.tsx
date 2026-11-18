import {CheckCircle2, Download, ImagePlus, RotateCcw, Sparkles, X} from 'lucide-react';
import {useRef, useState} from 'react';

interface BrandingModalProps {
  isOpen: boolean;
  currentAvatarUrl: string;
  onUpdatePreviewAvatar: (url: string | null) => void;
  onClose: () => void;
}

interface GeneratedVariant {
  filename: string;
  label: string;
  size: number;
  purpose: string;
  dataUrl: string;
}

function renderVariantToDataUrl(
  img: HTMLImageElement,
  size: number,
  {rounded, paddingRatio, bgColor}: {rounded: boolean; paddingRatio: number; bgColor: string}
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  const pad = Math.round(size * paddingRatio);
  const drawSize = size - pad * 2;

  ctx.save();
  if (rounded) {
    const radius = Math.round(drawSize * 0.22);
    ctx.beginPath();
    ctx.roundRect(pad, pad, drawSize, drawSize, radius);
    ctx.clip();
  }

  // Cover-crop square center
  const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const sx = ((img.naturalWidth || img.width) - minSide) / 2;
  const sy = ((img.naturalHeight || img.height) - minSide) / 2;
  ctx.drawImage(img, sx, sy, minSide, minSide, pad, pad, drawSize, drawSize);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

export function BrandingModal({
  isOpen,
  currentAvatarUrl,
  onUpdatePreviewAvatar,
  onClose,
}: BrandingModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMsg(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        const avatar256 = renderVariantToDataUrl(img, 256, {
          rounded: true,
          paddingRatio: 0,
          bgColor: '',
        });
        const pwa192 = renderVariantToDataUrl(img, 192, {
          rounded: true,
          paddingRatio: 0,
          bgColor: '',
        });
        const pwa512 = renderVariantToDataUrl(img, 512, {
          rounded: true,
          paddingRatio: 0,
          bgColor: '',
        });
        const maskable512 = renderVariantToDataUrl(img, 512, {
          rounded: false,
          paddingRatio: 0.14,
          bgColor: '#141224',
        });
        const apple180 = renderVariantToDataUrl(img, 180, {
          rounded: false,
          paddingRatio: 0.06,
          bgColor: '#141224',
        });

        setVariants([
          {
            filename: 'app-avatar.png',
            label: 'Avatar Header (256×256)',
            size: 256,
            purpose: 'Hiển thị cạnh tên Tủ sách Rủ Rỉ Rù Rì',
            dataUrl: avatar256,
          },
          {
            filename: 'pwa-192x192.png',
            label: 'Icon PWA 192×192',
            size: 192,
            purpose: 'Manifest chuẩn (purpose: any)',
            dataUrl: pwa192,
          },
          {
            filename: 'pwa-512x512.png',
            label: 'Icon PWA 512×512',
            size: 512,
            purpose: 'Màn hình khởi động & kho ứng dụng',
            dataUrl: pwa512,
          },
          {
            filename: 'pwa-maskable-512x512.png',
            label: 'Icon Maskable 512×512',
            size: 512,
            purpose: 'Android tự bo tròn có vùng an toàn 14%',
            dataUrl: maskable512,
          },
          {
            filename: 'apple-touch-icon.png',
            label: 'Apple Touch Icon 180×180',
            size: 180,
            purpose: 'Màn hình chính iPhone / iPad',
            dataUrl: apple180,
          },
        ]);

        onUpdatePreviewAvatar(avatar256);
        setStatusMsg(
          'Đã cập nhật xem trước Avatar trên Header và tạo sẵn đủ 5 kích thước icon PWA.'
        );
      };
      img.onerror = () => {
        setErrorMsg('Không thể đọc tệp ảnh này. Vui lòng chọn ảnh PNG, JPG, SVG hoặc WebP.');
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const downloadOne = (variant: GeneratedVariant) => {
    const a = document.createElement('a');
    a.href = variant.dataUrl;
    a.download = variant.filename;
    a.click();
  };

  const downloadAll = () => {
    variants.forEach((v, idx) => {
      setTimeout(() => downloadOne(v), idx * 180);
    });
  };

  const isCustomPreview = currentAvatarUrl !== '/app-avatar.png';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branding-modal-title"
    >
      <div
        className="fixed inset-0 bg-[#1B1408]/50 backdrop-blur-xs dark:bg-[#0B0917]/70"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DEC999] bg-[#FDF8EB] shadow-2xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
        <div className="flex items-center justify-between border-b border-[#DEC999] px-6 py-4 dark:border-[#2E294D]">
          <div>
            <h2
              id="branding-modal-title"
              className="font-display text-lg font-semibold text-[#2B2111] dark:text-[#F4EFFB]"
            >
              Logo / Avatar & Biểu tượng PWA
            </h2>
            <p className="mt-0.5 text-xs text-[#6D5937] dark:text-[#ACA4CA]">
              Nơi chứa sẵn vị trí avatar ứng dụng và bộ icon cài đặt PWA trên điện thoại / máy tính
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
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

          {/* Current Avatar Slot & Upload Trigger */}
          <div className="flex flex-col gap-4 rounded-xl border border-[#DEC999] bg-[#F7ECCE]/75 p-4 sm:flex-row sm:items-center dark:border-[#302B4F] dark:bg-[#19162D]">
            <div className="flex items-center gap-3.5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#DEC999] bg-[#141224] shadow-sm dark:border-[#37315A]">
                <img
                  src={currentAvatarUrl}
                  alt="Avatar Tủ sách Rủ Rỉ Rù Rì"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                  Avatar ứng dụng hiện tại
                </p>
                <p className="mt-0.5 text-xs text-[#5C492B] dark:text-[#ACA4CA]">
                  Hiển thị cạnh tiêu đề <strong>Tủ sách Rủ Rỉ Rù Rì</strong> và biểu tượng màn hình chính.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelectImage}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#7A4B0C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
              >
                <ImagePlus className="h-4 w-4" />
                <span>Tải ảnh logo / avatar lên</span>
              </button>
              {isCustomPreview && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePreviewAvatar(null);
                    setVariants([]);
                    setStatusMsg('Đã khôi phục về avatar mặc định (/app-avatar.png).');
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-3 py-2 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#DCD6F0] dark:hover:bg-[#2D284D]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Mặc định</span>
                </button>
              )}
            </div>
          </div>

          {/* Generated Ready-to-Drop PNG Variants */}
          {variants.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[#DEC999] bg-[#FFFDF6] p-4 dark:border-[#302B4F] dark:bg-[#231F3D]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                  <Sparkles className="h-4 w-4 text-[#7A4B0C] dark:text-[#D5B263]" />
                  <span>Bộ 5 file ảnh đã cắt đúng chuẩn từ logo của bạn</span>
                </div>
                <button
                  type="button"
                  onClick={downloadAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2B2111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4B3B21] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải tất cả 5 file</span>
                </button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {variants.map((v) => (
                  <div
                    key={v.filename}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#ECDCB4] bg-[#FDF8EB] p-2.5 dark:border-[#322C52] dark:bg-[#19162D]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <img
                        src={v.dataUrl}
                        alt={v.label}
                        className="h-10 w-10 shrink-0 rounded-lg border border-[#DEC999] object-cover dark:border-[#37315A]"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-mono-tabular text-xs font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                          {v.filename}
                        </p>
                        <p className="truncate text-[11px] text-[#6D5937] dark:text-[#9E94C0]">
                          {v.purpose}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadOne(v)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D3BC87] text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                      title={`Tải ${v.filename}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Static Folder Guide */}
          <div className="rounded-xl border border-[#DEC999] bg-[#F7ECCE]/60 p-4 text-xs leading-relaxed text-[#5C492B] dark:border-[#302B4F] dark:bg-[#19162D]/80 dark:text-[#ACA4CA]">
            <p className="font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
              Các vị trí file tĩnh đã tạo sẵn trong thư mục <code className="font-mono-tabular">public/</code>:
            </p>
            <ul className="mt-2 space-y-1 font-mono-tabular text-[11px]">
              <li>• public/app-avatar.png (256×256) — Avatar hiển thị cạnh tên ứng dụng</li>
              <li>• public/pwa-192x192.png (192×192) — Icon PWA chính</li>
              <li>• public/pwa-512x512.png (512×512) — Icon PWA độ phân giải cao</li>
              <li>• public/pwa-maskable-512x512.png (512×512) — Icon maskable cho Android</li>
              <li>• public/apple-touch-icon.png (180×180) — Icon cho iPhone / iPad Safari</li>
              <li>• public/favicon.ico — Biểu tượng trên tab trình duyệt</li>
            </ul>
            <p className="mt-2.5 text-[11px]">
              Khi cần thay đổi vĩnh viễn cho mọi người dùng trước khi deploy lên Vercel/Netlify/GitHub Pages, chỉ cần tải 5 file ảnh ở trên và chép đè vào thư mục <code className="font-mono-tabular">public/</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
