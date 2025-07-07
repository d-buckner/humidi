import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import terser from '@rollup/plugin-terser';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    minify: 'terser',
    rollupOptions: {
      plugins: terser()
    },
    lib: {
      entry: 'src/index.ts',
      name: 'humidi',
      fileName: 'index',
      formats: ['es'],
    },
  },
});