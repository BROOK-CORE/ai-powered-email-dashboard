import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { activeProvider } from './services/aiService.js';
import { strictCors, securityHeaders, enforceHttps, createRateLimiter, parseProxyHops } from './middleware/security.js';
import { attachRequestId, logSecurityEvent } from './services/securityLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ASSET_EXT_RX = /\.(?:js|mjs|css|map|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|eot|json|txt)$/i;

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', parseProxyHops());
  app.set('query parser', 'simple');

  app.use(attachRequestId);
  app.use(securityHeaders);
  app.use(enforceHttps);
  app.use(strictCors);
  app.use(express.json({ limit: '256kb' }));

  const apiLimiter = createRateLimiter({ name: 'api', windowMs: 15 * 60 * 1000, max: 300 });
  app.use('/api', apiLimiter);

  app.get('/api/health', (req, res) => res.json({ ok: true, ai: activeProvider(), time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/rules', ruleRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app (single-service deployment).
  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(
      express.static(dist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-store');
          }
        },
      })
    );
    app.use((req, res, next) => {
      if ((req.method === 'GET' || req.method === 'HEAD') && (req.path.startsWith('/assets/') || STATIC_ASSET_EXT_RX.test(req.path))) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).type('text/plain').send('Not found');
      }
      return next();
    });
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.name === 'CastError' ? 400 : err.status || 500;
    logSecurityEvent({
      event: status >= 500 ? 'server.error' : 'validation.failed',
      severity: status >= 500 ? 'error' : 'warn',
      outcome: 'failure',
      req,
      meta: { name: err.name || 'Error', code: err.code || null, status, rule: err.name === 'CastError' ? 'cast_error' : 'unhandled_error' },
    });
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
    const msg = status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Something went wrong';
    res.status(status).json({ error: msg });
  });

  return app;
}
