import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';

    return {
      server: {
        port: 4000,
        host: '0.0.0.0',
        strictPort: true,
      },
      plugins: [tailwindcss(), react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'es2022',
        minify: 'esbuild',
        sourcemap: !isProd,
        cssCodeSplit: true,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-genai': ['@google/genai'],
              'vendor-icons': ['lucide-react'],
              'vendor-utils': ['zustand', 'swr', 'jszip'],
              'editor-video': [
                './components/VideoEditor.tsx',
                './components/StoryboardVideoNode.tsx',
                './components/StoryboardEditor.tsx',
              ],
              'editor-image': [
                './components/ImageCropper.tsx',
                './components/SketchEditor.tsx',
              ],
              'editor-audio': [
                './components/SonicStudio.tsx',
              ],
              'editor-character': [
                './components/CharacterLibrary.tsx',
                './components/CharacterDetailModal.tsx',
              ],
              'services-ai': [
                './services/geminiService.ts',
                './services/geminiServiceWithFallback.ts',
                './services/modelFallback.ts',
                './services/soraService.ts',
              ],
              'services-storage': [
                './services/storage/IndexedDBService.ts',
                './services/storage/FileStorageService.ts',
                './services/storage/MetadataManager.ts',
                './services/ossService.ts',
              ],
            },
          },
        },
        chunkSizeWarningLimit: 600,
      },
      esbuild: {
        drop: isProd ? ['console', 'debugger'] : [],
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'zustand', 'swr', 'lucide-react'],
      },
    };
});
