import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';


export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: 'src/index.ts',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
});