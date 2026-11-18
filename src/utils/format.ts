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

export function normalizeExternalAudioUrl(rawInput: string): {
  playableUrl: string;
  originalUrl: string;
  providerLabel: string;
  isGoogleDrive: boolean;
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

  // Google Drive: convert share link to export=download URL
  const gdriveMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);

  if (gdriveMatch && gdriveMatch[1]) {
    const directGDrive = `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
    return {
      playableUrl: directGDrive,
      originalUrl: trimmed,
      providerLabel: 'Google Drive',
      isGoogleDrive: true,
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
    audio.src = url;
  });
}
