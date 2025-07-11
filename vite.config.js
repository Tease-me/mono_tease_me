import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [tailwindcss(), react(), svgr({ include: '**/*.svg', }),],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
