import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** 外部通信を一切しないため、実行時に取得するアセットは自ホストのみ。 */
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    host: true,
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 2500,
    // modulepreload のポリフィルは fetch を使うため無効化する（対応ブラウザのみ対象）
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // 依存を分けて、初回表示を軽くする（重いものは使うときに読み込む）
        manualChunks(id: string) {
          if (id.includes('heic2any')) return 'heic';
          if (id.includes('@zxing')) return 'zxing';
          if (id.includes('exifr')) return 'exif';
          if (id.includes('marked')) return 'markdown';
          return undefined;
        },
      },
    },
  },
});
