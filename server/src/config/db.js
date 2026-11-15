import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoCacheRoot = path.resolve(__dirname, '../../../.cache');
const localBinaryCache = path.join(repoCacheRoot, 'mongodb-binaries');
const localTmpDir = path.join(repoCacheRoot, 'tmp');

/**
 * Connects to MongoDB.
 * - MONGODB_URI set  -> use it (e.g. MongoDB Atlas free tier for deployment)
 * - MONGODB_URI unset -> spin up an in-memory MongoDB (local dev / zero-config demo)
 */
export async function connectDb() {
  let uri = process.env.MONGODB_URI;
  let memory = null;

  if (!uri) {
    if (!process.env.MONGOMS_DOWNLOAD_DIR && fs.existsSync(localBinaryCache)) {
      process.env.MONGOMS_DOWNLOAD_DIR = localBinaryCache;
    }
    if (fs.existsSync(localTmpDir)) {
      process.env.TMPDIR ||= localTmpDir;
      process.env.TEMP ||= localTmpDir;
      process.env.TMP ||= localTmpDir;
    }

    const downloadDir = process.env.MONGOMS_DOWNLOAD_DIR || (fs.existsSync(localBinaryCache) ? localBinaryCache : undefined);
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memory = await MongoMemoryServer.create(
      downloadDir ? { binary: { downloadDir } } : undefined
    );
    uri = memory.getUri('ai_email_dashboard');
    console.log('[db] MONGODB_URI not set -> using in-memory MongoDB (data resets on restart)');
  } else {
    console.log('[db] connecting to MongoDB via MONGODB_URI');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('[db] connected');
  return { memory };
}

export async function disconnectDb(ctx) {
  await mongoose.disconnect();
  if (ctx?.memory) await ctx.memory.stop();
}
