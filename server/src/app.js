import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { activeProvider } from './services/aiService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, ai: activeProvider(), time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app (single-service deployment).
  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
  });

  return app;
}
