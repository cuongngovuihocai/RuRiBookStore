export const RURITTS_APP_URL = 'https://cuongngovuihocai.github.io/RuRiTTS/';

export interface RuRiTTSChapterInput {
  title?: string;
  durationSec?: number;
  audioUrl?: string;
  fileBlob?: Blob;
  audioBuffer?: ArrayBuffer;
  dataUrl?: string;
  mimeType?: string;
  filename?: string;
}

export interface RuRiTTSPendingFile {
  id: string;
  title: string;
  filename: string;
  blob: Blob;
  durationSec: number;
}

export interface RuRiTTSReadyUrlChapter {
  title: string;
  audioUrl: string;
  durationSec: number;
}

export interface RuRiTTSImportedDraft {
  title?: string;
  author?: string;
  narrator?: string;
  category?: string;
  keywords?: string[];
  description?: string;
  pendingFiles: RuRiTTSPendingFile[];
  readyUrls: RuRiTTSReadyUrlChapter[];
}

function isTrustedRuRiTTSOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === window.location.origin) return true;
  if (origin === 'https://cuongngovuihocai.github.io') return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith('.vercel.app')) return true;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  } catch {
    return false;
  }
  return false;
}

function dataUrlToBlob(dataUrl: string, fallbackMime = 'audio/mpeg'): Blob | null {
  try {
    const [header, base64] = dataUrl.split(',');
    if (!base64) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new Blob([bytes], {type: mime});
  } catch {
    return null;
  }
}

export function parseRuRiTTSMessage(event: MessageEvent): RuRiTTSImportedDraft | null {
  if (!isTrustedRuRiTTSOrigin(event.origin)) return null;
  const raw = event.data as {
    type?: string;
    payload?: {
      title?: string;
      author?: string;
      narrator?: string;
      category?: string;
      keywords?: string[];
      description?: string;
      chapters?: RuRiTTSChapterInput[];
    };
  } | null;

  if (!raw || raw.type !== 'RURITTS_EXPORT_STORY' || !raw.payload) {
    return null;
  }

  const chaptersInput = Array.isArray(raw.payload.chapters) ? raw.payload.chapters : [];
  const pendingFiles: RuRiTTSPendingFile[] = [];
  const readyUrls: RuRiTTSReadyUrlChapter[] = [];

  chaptersInput.forEach((ch, idx) => {
    const chTitle = (ch.title || '').trim() || `Chương ${idx + 1}`;
    const durationSec = typeof ch.durationSec === 'number' && ch.durationSec > 0 ? Math.round(ch.durationSec) : 0;

    if (typeof ch.audioUrl === 'string' && /^https?:\/\//i.test(ch.audioUrl.trim())) {
      readyUrls.push({
        title: chTitle,
        audioUrl: ch.audioUrl.trim(),
        durationSec,
      });
      return;
    }

    let blob: Blob | null = null;
    if (ch.fileBlob instanceof Blob) {
      blob = ch.fileBlob;
    } else if (ch.audioBuffer instanceof ArrayBuffer) {
      blob = new Blob([ch.audioBuffer], {type: ch.mimeType || 'audio/mpeg'});
    } else if (typeof ch.dataUrl === 'string' && ch.dataUrl.startsWith('data:')) {
      blob = dataUrlToBlob(ch.dataUrl, ch.mimeType || 'audio/mpeg');
    }

    if (blob) {
      const ext = blob.type.includes('wav')
        ? 'wav'
        : blob.type.includes('ogg')
          ? 'ogg'
          : blob.type.includes('mp4') || blob.type.includes('m4a')
            ? 'm4a'
            : 'mp3';
      pendingFiles.push({
        id: `tts-${crypto.randomUUID()}`,
        title: chTitle,
        filename: ch.filename || `chuong-${idx + 1}.${ext}`,
        blob,
        durationSec,
      });
    }
  });

  return {
    title: raw.payload.title?.trim(),
    author: raw.payload.author?.trim(),
    narrator: raw.payload.narrator?.trim(),
    category: raw.payload.category?.trim(),
    keywords: Array.isArray(raw.payload.keywords) ? raw.payload.keywords : undefined,
    description: raw.payload.description?.trim(),
    pendingFiles,
    readyUrls,
  };
}
