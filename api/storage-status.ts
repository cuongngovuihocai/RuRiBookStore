import {getSupabaseConfig} from '../server/supabaseStorage';

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

  const cfg = getSupabaseConfig();
  res.status(200).json({
    configured: cfg.configured,
    bucket: cfg.bucket,
  });
}
