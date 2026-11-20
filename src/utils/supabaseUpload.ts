import {auth} from '../firebase';

export interface SupabaseStorageStatus {
  configured: boolean;
  bucket: string;
  apiError?: string;
}

export async function checkSupabaseStorageStatus(): Promise<SupabaseStorageStatus> {
  try {
    const resp = await fetch('/api/storage-status');
    if (!resp.ok) {
      return {
        configured: false,
        bucket: 'audiobooks',
        apiError: `API /api/storage-status trả về lỗi HTTP ${resp.status}.`,
      };
    }
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        configured: false,
        bucket: 'audiobooks',
        apiError: 'API /api/storage-status không trả về JSON hợp lệ.',
      };
    }
    return (await resp.json()) as SupabaseStorageStatus;
  } catch {
    return {
      configured: false,
      bucket: 'audiobooks',
      apiError: 'Không thể kết nối tới API /api/storage-status.',
    };
  }
}

export function getAudioDurationFromBlob(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    const finish = (sec: number) => {
      URL.revokeObjectURL(objectUrl);
      audio.src = '';
      resolve(sec);
    };

    const timer = window.setTimeout(() => finish(0), 6000);
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const dur = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      finish(dur);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(0);
    };
    audio.src = objectUrl;
  });
}

export async function uploadAudioToSupabase(
  file: Blob,
  options: {
    filename: string;
    storyFolder?: string;
    onProgress?: (percent: number) => void;
  }
): Promise<{
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
}> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Vui lòng đăng nhập tài khoản Admin trước khi tải file lên.');
  }

  const idToken = await user.getIdToken();
  const contentType = file.type || 'audio/mpeg';

  const signResp = await fetch('/api/storage-sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      filename: options.filename,
      storyFolder: options.storyFolder || 'library',
    }),
  });

  const signData = (await signResp.json()) as {
    error?: string;
    signedUploadUrl?: string;
    publicUrl?: string;
  };

  if (!signResp.ok || !signData.signedUploadUrl || !signData.publicUrl) {
    throw new Error(signData.error || 'Không thể xin quyền tải file lên Supabase Storage.');
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signData.signedUploadUrl!, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        resolve();
      } else {
        reject(
          new Error(
            `Tải file lên Supabase thất bại (HTTP ${xhr.status}). Hãy kiểm tra dung lượng file (≤ 50MB) và quyền bucket.`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error('Lỗi mạng hoặc CORS khi tải file lên Supabase Storage.'));
    };

    xhr.send(file);
  });

  return {
    publicUrl: signData.publicUrl,
    sizeBytes: file.size,
    mimeType: contentType,
  };
}

export async function uploadCoverToSupabase(
  file: Blob,
  options: {
    filename: string;
    storyFolder?: string;
  }
): Promise<string> {
  const result = await uploadAudioToSupabase(file, {
    filename: options.filename,
    storyFolder: options.storyFolder || 'covers',
  });
  return result.publicUrl;
}

