import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/UAS_VD/',
  plugins: [
    tailwindcss(),
  ],
  server: {
    port: 3000,
    open: false
  }
});
