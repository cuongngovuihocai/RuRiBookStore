interface ApiReq {
  method?: string;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (body: unknown) => void;
}

export default function handler(req: ApiReq, res: ApiRes) {
  if (req.method !== 'GET') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }

  const url = (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/storage\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const bucket = (process.env.SUPABASE_BUCKET || 'audiobooks').trim();

  res.status(200).json({
    configured: Boolean(url && serviceKey),
    bucket,
  });
}
