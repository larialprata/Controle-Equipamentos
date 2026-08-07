import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

// https://vite.dev/config/
export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(pkg.version),
  },
  build: {
    sourcemap: 'hidden',
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
  },
  plugins: [
    react({
      babel: {
        plugins: process.env.NODE_ENV === 'production' ? [] : ['react-dev-locator'],
      },
    }),
    tsconfigPaths(),
  ],
})
