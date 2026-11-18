import {
  createSupabaseSignedUpload,
  verifyAdminFirebaseToken,
} from '../server/supabaseStorage';

interface ApiReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: {
    filename?: string;
    storyFolder?: string;
  };
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (body: unknown) => void;
}

export default async function handler(req: ApiReq, res: ApiRes) {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }

  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

  const authCheck = await verifyAdminFirebaseToken(authHeader);
  if (!authCheck.ok) {
    res.status(authCheck.status).json({error: authCheck.error});
    return;
  }

  const body = req.body || {};
  const result = await createSupabaseSignedUpload({
    filename: typeof body.filename === 'string' ? body.filename : 'audio.mp3',
    storyFolder: typeof body.storyFolder === 'string' ? body.storyFolder : 'library',
  });

  if (!result.ok) {
    res.status(result.status).json({error: result.error, code: result.code});
    return;
  }

  res.status(200).json({
    signedUploadUrl: result.signedUploadUrl,
    publicUrl: result.publicUrl,
    objectPath: result.objectPath,
    bucket: result.bucket,
  });
}
