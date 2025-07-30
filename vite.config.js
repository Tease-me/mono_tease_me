import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';
import path from "path";
import svgr from "vite-plugin-svgr";
import fs from 'fs';

export default defineConfig({
  plugins: [tailwindcss(), react(), svgr() ],
  server: {
    port: 3000,
    host: true,
    open: true,
    https: {
      key: fs.readFileSync('./.cert/key.pem'),
      cert: fs.readFileSync('./.cert/cert.pem'),
    },
  },
  preview: {
    port: 4174, // 👈 Change this to your desired preview port
    host: true,
    https: {
      key: fs.readFileSync('./.cert/key.pem'),
      cert: fs.readFileSync('./.cert/cert.pem'),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  }
});
