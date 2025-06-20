import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';


export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'humidi',
      fileName: 'index',
      formats: ['es'],
    },
  },
});