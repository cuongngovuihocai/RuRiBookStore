import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_ADMIN_EMAIL = 'cuongngovuihocai@gmail.com';
const DEFAULT_BUCKET = 'audiobooks';

interface ApiReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (body: unknown) => void;
}

function getFirebaseApiKey(): string {
  if (process.env.FIREBASE_API_KEY) {
    return process.env.FIREBASE_API_KEY.trim();
  }
  if (process.env.VITE_FIREBASE_API_KEY) {
    return process.env.VITE_FIREBASE_API_KEY.trim();
  }
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'firebase-applet-config.json'),
  ];
  for (const cfgPath of candidates) {
    try {
      if (fs.existsSync(cfgPath)) {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {apiKey?: string};
        if (parsed.apiKey) return parsed.apiKey.trim();
      }
    } catch {
      // Ignore file read errors in serverless bundle
    }
  }
  return '';
}

function getSupabaseConfig() {
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

function parseBody(rawBody: unknown): {filename?: string; storyFolder?: string} {
  if (!rawBody) return {};
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as {filename?: string; storyFolder?: string};
    } catch {
      return {};
    }
  }
  if (typeof rawBody === 'object') {
    return rawBody as {filename?: string; storyFolder?: string};
  }
  return {};
}

export default async function handler(req: ApiReq, res: ApiRes) {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }

  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({error: 'Thiếu token xác thực quản trị viên.'});
    return;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({error: 'Token xác thực không hợp lệ.'});
    return;
  }

  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    res.status(500).json({error: 'Thiếu cấu hình Firebase API key trên máy chủ.'});
    return;
  }

  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    res.status(503).json({
      code: 'SUPABASE_NOT_CONFIGURED',
      error:
        'Chưa cấu hình SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong biến môi trường máy chủ.',
    });
    return;
  }

  try {
    const authResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({idToken}),
      }
    );

    if (!authResp.ok) {
      res.status(401).json({error: 'Phiên đăng nhập Admin đã hết hạn hoặc không hợp lệ.'});
      return;
    }

    const authData = (await authResp.json()) as {
      users?: Array<{email?: string; emailVerified?: boolean}>;
    };
    const user = authData.users?.[0];

    if (!user?.email || !user.emailVerified || user.email.toLowerCase() !== cfg.adminEmail) {
      res.status(403).json({error: 'Tài khoản không có quyền upload audio quản trị.'});
      return;
    }
  } catch {
    res.status(502).json({error: 'Không thể xác minh phiên đăng nhập Firebase.'});
    return;
  }

  const body = parseBody(req.body);
  const folder = sanitizeSegment(
    typeof body.storyFolder === 'string' ? body.storyFolder : 'library',
    'library'
  ).slice(0, 60);
  const rawName = typeof body.filename === 'string' && body.filename ? body.filename : 'audio.mp3';
  const dotIdx = rawName.lastIndexOf('.');
  const basePart = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName;
  const extPart =
    dotIdx > 0 ? rawName.slice(dotIdx).toLowerCase().replace(/[^a-z0-9.]/g, '') : '.mp3';
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

    const signResp = await fetch(signEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    if (!signResp.ok) {
      const text = await signResp.text();
      res.status(signResp.status).json({
        error: `Supabase từ chối tạo link upload (${signResp.status}): ${text.slice(0, 200)}`,
      });
      return;
    }

    const signData = (await signResp.json()) as {url?: string; token?: string};
    if (!signData.url) {
      res.status(502).json({error: 'Supabase không trả về signed upload URL.'});
      return;
    }

    const signedUploadUrl = signData.url.startsWith('http')
      ? signData.url
      : `${cfg.url}/storage/v1${signData.url.startsWith('/') ? '' : '/'}${signData.url}`;

    const publicUrl = `${cfg.url}/storage/v1/object/public/${encodeURIComponent(
      cfg.bucket
    )}/${encodedPath}`;

    res.status(200).json({
      signedUploadUrl,
      publicUrl,
      objectPath,
      bucket: cfg.bucket,
    });
  } catch (err) {
    res.status(502).json({
      error:
        err instanceof Error
          ? `Lỗi kết nối Supabase Storage: ${err.message}`
          : 'Lỗi kết nối Supabase Storage.',
    });
  }
}
