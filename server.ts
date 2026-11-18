import express from 'express';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {
  createSupabaseSignedUpload,
  getSupabaseConfig,
  verifyAdminFirebaseToken,
} from './server/supabaseStorage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({limit: '1mb'}));

  app.get('/api/storage-status', (_req, res) => {
    const cfg = getSupabaseConfig();
    res.status(200).json({
      configured: cfg.configured,
      bucket: cfg.bucket,
    });
  });

  app.post('/api/storage-sign', async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({error: authCheck.error});
      return;
    }

    const body = (req.body || {}) as {filename?: string; storyFolder?: string};
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
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {server: httpServer},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Tu sach Ru Ri Ru Ri running at http://localhost:${PORT}`);
  });
}

startServer();
