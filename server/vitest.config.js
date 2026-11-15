import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 600000, // first run may download the mongod binary
    fileParallelism: false,
    env: {
      MONGOMS_DOWNLOAD_DIR: path.resolve(here, '../.cache/mongodb-binaries'),
      GROQ_API_KEY: '',
      GEMINI_API_KEY: '',
      OPENAI_API_KEY: '',
      JWT_SECRET: 'test-secret',
    },
  },
});
