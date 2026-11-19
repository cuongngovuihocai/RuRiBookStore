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
    return 'Thiếu Google API Key để phát file Google Drive qua Drive API.';
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
      return 'Project Google Cloud (audiobook-17868) chưa bật "Google Drive API". Hãy bật Google Drive API trong Google Cloud Console rồi thử lại.';
    }
    if (resp.status === 403) {
      return 'API Key bị giới hạn quyền hoặc Google Drive tạm giới hạn lượt tải cho file này.';
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
