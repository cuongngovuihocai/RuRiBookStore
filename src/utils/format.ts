import firebaseConfig from '../../firebase-applet-config.json';

export interface CuratedCover {
  id: string;
  label: string;
  url: string;
}

export const CURATED_COVERS: CuratedCover[] = [
  {
    id: 'rain',
    label: 'Mưa bên hiên',
    url: '/src/assets/images/cover_novel_rain_1794949188336.jpg',
  },
  {
    id: 'lantern',
    label: 'Đèn lồng sông đêm',
    url: '/src/assets/images/cover_folklore_lantern_1794949188795.jpg',
  },
  {
    id: 'library',
    label: 'Thư phòng cổ',
    url: '/src/assets/images/cover_mystery_library_1794949189389.jpg',
  },
  {
    id: 'mist',
    label: 'Sương sớm đồi chè',
    url: '/src/assets/images/cover_mindfulness_lotus_1794949189015.jpg',
  },
];

export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatTotalDurationVi(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Chưa rõ thời lượng';
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 1) return `${Math.max(1, Math.round(seconds))} giây`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins} phút`;
  if (mins === 0) return `${hrs} giờ`;
  return `${hrs} giờ ${mins} phút`;
}

export function getGoogleDriveApiKey(): string {
  const envKey = (import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || '').trim();
  if (envKey) return envKey;
  return (firebaseConfig.apiKey || '').trim();
}

/**
 * Extracts a Google Drive File ID from full Drive URLs, gdrive:// URIs,
 * or a raw Drive File ID pasted directly (text after /d/).
 */
export function extractGoogleDriveFileId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const patterns = [
    /^gdrive:\/\/([a-zA-Z0-9_-]{10,})$/i,
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/open\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
    /drive\.usercontent\.google\.com\/download\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
    /docs\.google\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i,
    /googleapis\.com\/drive\/v3\/files\/([a-zA-Z0-9_-]+)/i,
  ];

  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }

  // Raw Drive File ID pasted directly (e.g. text after /d/)
  if (/^[a-zA-Z0-9_-]{20,100}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function buildGoogleDriveStreamUrl(fileId: string): string {
  const apiKey = getGoogleDriveApiKey();
  if (apiKey) {
    return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media&key=${encodeURIComponent(apiKey)}`;
  }
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

export function buildGoogleDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

/**
 * Resolves stored chapter audioUrl into an actually streamable URL at playback time.
 * Converts gdrive://<id> or legacy Google Drive uc?export=download links to Drive API v3 alt=media.
 */
export function resolvePlayableAudioUrl(storedUrl: string): string {
  const trimmed = (storedUrl || '').trim();
  if (!trimmed) return '';
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return buildGoogleDriveStreamUrl(driveId);
  }
  return trimmed;
}

export async function diagnoseGoogleDriveFile(fileId: string): Promise<string | null> {
  const apiKey = getGoogleDriveApiKey();
  if (!apiKey) {
    return 'Thiếu Google API Key cho Drive API. Đang dùng trình phát nhúng Google Drive (/preview).';
  }
  try {
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}?fields=id,name,mimeType&key=${encodeURIComponent(apiKey)}`
    );
    if (resp.ok) {
      return null;
    }
    const errText = await resp.text();
    if (resp.status === 403 && /Drive API has not been used|accessNotConfigured/i.test(errText)) {
      return 'Chưa bật Google Drive API trên Google Cloud. Đang chuyển sang trình phát nhúng Google Drive (/preview).';
    }
    if (resp.status === 403 && /Permission denied on the service|ACCESS_DENIED/i.test(errText)) {
      return 'API Key mặc định của Firebase không được phép gọi Google Drive API (cần tạo API Key riêng có quyền Google Drive API vào biến VITE_GOOGLE_DRIVE_API_KEY). Đã tự chuyển sang trình phát nhúng Google Drive bên trên.';
    }
    if (resp.status === 403) {
      return 'API Key bị giới hạn quyền hoặc file Drive giới hạn lượt tải. Đã chuyển sang trình phát nhúng Google Drive (/preview).';
    }
    if (resp.status === 404) {
      return 'Không tìm thấy file hoặc file Drive chưa bật "Bất kỳ ai có đường liên kết (Người xem)".';
    }
    return `Google Drive API trả về lỗi HTTP ${resp.status}.`;
  } catch {
    return null;
  }
}

export function normalizeExternalAudioUrl(rawInput: string): {
  playableUrl: string;
  originalUrl: string;
  providerLabel: string;
  isGoogleDrive: boolean;
  driveFileId?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      playableUrl: '',
      originalUrl: '',
      providerLabel: 'Liên kết ngoài',
      isGoogleDrive: false,
    };
  }

  // Cloudflare R2
  if (trimmed.includes('.r2.dev/') || trimmed.includes('r2.cloudflarestorage.com')) {
    return {
      playableUrl: trimmed,
      originalUrl: trimmed,
      providerLabel: 'Cloudflare R2 (Stream trực tiếp)',
      isGoogleDrive: false,
    };
  }

  // Internet Archive
  if (trimmed.includes('archive.org/')) {
    return {
      playableUrl: trimmed,
      originalUrl: trimmed,
      providerLabel: 'Internet Archive (Miễn phí)',
      isGoogleDrive: false,
    };
  }

  // Dropbox: ?dl=0 or ?dl=1 -> raw=1
  if (trimmed.includes('dropbox.com/')) {
    let dbUrl = trimmed.replace(/[?&]dl=[01]/g, '');
    dbUrl += dbUrl.includes('?') ? '&raw=1' : '?raw=1';
    return {
      playableUrl: dbUrl,
      originalUrl: trimmed,
      providerLabel: 'Dropbox',
      isGoogleDrive: false,
    };
  }

  // Google Drive (full URL or raw File ID after /d/)
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return {
      playableUrl: `gdrive://${driveId}`,
      originalUrl: /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://drive.google.com/file/d/${driveId}/view`,
      providerLabel: 'Google Drive (API Stream)',
      isGoogleDrive: true,
      driveFileId: driveId,
    };
  }

  return {
    playableUrl: trimmed,
    originalUrl: trimmed,
    providerLabel: 'Link Audio trực tiếp',
    isGoogleDrive: false,
  };
}

export function getAudioDurationFromUrl(url: string): Promise<{ok: boolean; durationSec: number}> {
  const resolved = resolvePlayableAudioUrl(url);
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const cleanup = () => {
      audio.src = '';
      audio.load();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve({ok: false, durationSec: 0});
    }, 8000);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const dur = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      cleanup();
      resolve({ok: true, durationSec: dur});
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve({ok: false, durationSec: 0});
    };
    audio.src = resolved;
  });
}

/**
 * Converts Google Drive share links (or raw Drive File IDs) into direct embeddable
 * lh3.googleusercontent.com/d/<ID> image URLs matching the app logo format.
 * When targetWidth is provided, appends =w<width> so Google CDN serves a crisp,
 * server-resized image without client-side aliasing.
 */
export function normalizeCoverImageUrl(rawInput: string, targetWidth?: number): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    const base = `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}`;
    if (targetWidth && Number.isFinite(targetWidth) && targetWidth > 0) {
      return `${base}=w${Math.round(targetWidth)}`;
    }
    return base;
  }

  return trimmed;
}

const smoothCoverCache = new Map<string, string>();
const MAX_SMOOTH_CACHE_ENTRIES = 120;

function drawProgressiveStepDown(
  source: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  let curWidth = source.naturalWidth || source.width;
  let curHeight = source.naturalHeight || source.height;

  let curCanvas: HTMLCanvasElement | HTMLImageElement = source;

  // Step down by 50% per pass until within 2x of target dimensions to avoid aliasing/jagged edges
  while (curWidth * 0.5 >= targetWidth && curHeight * 0.5 >= targetHeight) {
    const nextW = Math.max(targetWidth, Math.round(curWidth * 0.5));
    const nextH = Math.max(targetHeight, Math.round(curHeight * 0.5));
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) break;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(curCanvas, 0, 0, nextW, nextH);
    curCanvas = stepCanvas;
    curWidth = nextW;
    curHeight = nextH;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const ctx = finalCanvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(curCanvas, 0, 0, targetWidth, targetHeight);
  }
  return finalCanvas;
}

/**
 * Downscales an image URL progressively in browser memory (when CORS allows)
 * so high-resolution covers rendered in small cards/thumbnails look crisp with no jagged edges.
 */
export async function getOptimizedCoverBlobUrl(
  srcUrl: string,
  targetWidth: number
): Promise<string | null> {
  const trimmed = (srcUrl || '').trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return null;
  }

  // Google CDN already handles server-side Lanczos resizing via =w<width>
  if (/^https:\/\/lh3\.googleusercontent\.com\/d\/.+=w\d+/i.test(trimmed)) {
    return null;
  }

  const cacheKey = `${trimmed}@w${Math.round(targetWidth)}`;
  const cached = smoothCoverCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      if (!natW || !natH || natW <= targetWidth * 1.3) {
        resolve(null);
        return;
      }

      const outW = Math.round(targetWidth);
      const outH = Math.max(1, Math.round((natH / natW) * outW));

      try {
        const canvas = drawProgressiveStepDown(img, outW, outH);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const blobUrl = URL.createObjectURL(blob);
            if (smoothCoverCache.size >= MAX_SMOOTH_CACHE_ENTRIES) {
              const firstKey = smoothCoverCache.keys().next().value;
              if (firstKey) {
                const oldUrl = smoothCoverCache.get(firstKey);
                if (oldUrl) URL.revokeObjectURL(oldUrl);
                smoothCoverCache.delete(firstKey);
              }
            }
            smoothCoverCache.set(cacheKey, blobUrl);
            resolve(blobUrl);
          },
          'image/webp',
          0.9
        );
      } catch {
        // SecurityError when remote server does not send CORS headers
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = trimmed;
  });
}

/**
 * Progressively downscales a local cover image file to book-cover resolution (max 600x800 WebP)
 * before uploading so cover art stays lightweight and free of jagged scaling artifacts.
 */
export async function optimizeCoverImageFile(
  file: File,
  maxWidth = 600,
  maxHeight = 800
): Promise<{blob: Blob; filename: string}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh đã chọn.'));
      el.src = objectUrl;
    });

    const natW = img.naturalWidth || maxWidth;
    const natH = img.naturalHeight || maxHeight;
    const scale = Math.min(1, maxWidth / natW, maxHeight / natH);
    const outW = Math.max(1, Math.round(natW * scale));
    const outH = Math.max(1, Math.round(natH * scale));

    const canvas = drawProgressiveStepDown(img, outW, outH);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('Không thể nén và tối ưu ảnh bìa.'));
        },
        'image/webp',
        0.88
      );
    });

    const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'cover';
    return {
      blob,
      filename: `${baseName}.webp`,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

