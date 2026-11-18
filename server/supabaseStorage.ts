import fs from 'fs';
import path from 'path';

const DEFAULT_ADMIN_EMAIL = 'cuongngovuihocai@gmail.com';
const DEFAULT_BUCKET = 'audiobooks';

function getFirebaseApiKey(): string {
  if (process.env.FIREBASE_API_KEY) {
    return process.env.FIREBASE_API_KEY;
  }
  if (process.env.VITE_FIREBASE_API_KEY) {
    return process.env.VITE_FIREBASE_API_KEY;
  }
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {apiKey?: string};
      if (parsed.apiKey) return parsed.apiKey;
    }
  } catch {
    // Ignore config read error
  }
  return '';
}

export function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/storage\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const bucket = (process.env.SUPABASE_BUCKET || DEFAULT_BUCKET).trim();
  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();

  return {
    configured: Boolean(url && serviceKey),
    url,
    serviceKey,
    bucket,
    adminEmail,
  };
}

export async function verifyAdminFirebaseToken(authHeader: string | undefined): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  email?: string;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {ok: false, status: 401, error: 'Thiếu token xác thực quản trị viên.'};
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return {ok: false, status: 401, error: 'Token xác thực không hợp lệ.'};
  }

  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    return {ok: false, status: 500, error: 'Thiếu cấu hình Firebase API key trên máy chủ.'};
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({idToken}),
      }
    );

    if (!resp.ok) {
      return {ok: false, status: 401, error: 'Phiên đăng nhập Admin đã hết hạn hoặc không hợp lệ.'};
    }

    const data = (await resp.json()) as {
      users?: Array<{email?: string; emailVerified?: boolean}>;
    };
    const user = data.users?.[0];
    const {adminEmail} = getSupabaseConfig();

    if (!user?.email || !user.emailVerified || user.email.toLowerCase() !== adminEmail) {
      return {
        ok: false,
        status: 403,
        error: 'Tài khoản không có quyền upload audio quản trị.',
      };
    }

    return {ok: true, status: 200, email: user.email};
  } catch {
    return {ok: false, status: 502, error: 'Không thể xác minh phiên đăng nhập Firebase.'};
  }
}

function sanitizeSegment(input: string, fallback: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export async function createSupabaseSignedUpload(params: {
  filename: string;
  storyFolder?: string;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  code?: string;
  signedUploadUrl?: string;
  publicUrl?: string;
  objectPath?: string;
  bucket?: string;
}> {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      status: 503,
      code: 'SUPABASE_NOT_CONFIGURED',
      error:
        'Chưa cấu hình SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong biến môi trường máy chủ.',
    };
  }

  const folder = sanitizeSegment(params.storyFolder || 'library', 'library').slice(0, 60);
  const rawName = params.filename || 'audio.mp3';
  const dotIdx = rawName.lastIndexOf('.');
  const basePart = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName;
  const extPart = dotIdx > 0 ? rawName.slice(dotIdx).toLowerCase().replace(/[^a-z0-9.]/g, '') : '.mp3';
  const safeName = `${sanitizeSegment(basePart, 'chapter').slice(0, 70)}${extPart || '.mp3'}`;
  const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const objectPath = `${folder}/${uniquePrefix}-${safeName}`;

  const encodedPath = objectPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');

  const signEndpoint = `${cfg.url}/storage/v1/object/upload/sign/${encodeURIComponent(
    cfg.bucket
  )}/${encodedPath}`;

  try {
    const isModernSecretKey = cfg.serviceKey.startsWith('sb_secret_');
    const headers: Record<string, string> = {
      apikey: cfg.serviceKey,
      'Content-Type': 'application/json',
    };
    if (!isModernSecretKey) {
      headers.Authorization = `Bearer ${cfg.serviceKey}`;
    }

    const resp = await fetch(signEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        ok: false,
        status: resp.status,
        error: `Supabase từ chối tạo link upload (${resp.status}): ${text.slice(0, 200)}`,
      };
    }

    const data = (await resp.json()) as {url?: string; token?: string};
    if (!data.url) {
      return {
        ok: false,
        status: 502,
        error: 'Supabase không trả về signed upload URL.',
      };
    }

    const signedUploadUrl = data.url.startsWith('http')
      ? data.url
      : `${cfg.url}/storage/v1${data.url.startsWith('/') ? '' : '/'}${data.url}`;

    const publicUrl = `${cfg.url}/storage/v1/object/public/${encodeURIComponent(
      cfg.bucket
    )}/${encodedPath}`;

    return {
      ok: true,
      status: 200,
      signedUploadUrl,
      publicUrl,
      objectPath,
      bucket: cfg.bucket,
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error:
        err instanceof Error
          ? `Lỗi kết nối Supabase Storage: ${err.message}`
          : 'Lỗi kết nối Supabase Storage.',
    };
  }
}
