import 'dotenv/config';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { ensureDemoData } from './seed/seed.js';
import { activeProvider } from './services/aiService.js';

const PORT = process.env.PORT || 5000;

async function main() {
  await connectDb();
  await ensureDemoData();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}  (AI engine: ${activeProvider()})`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
