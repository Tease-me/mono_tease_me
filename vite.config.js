import react from '@vitejs/plugin-react';
import path from "path";
import { defineConfig } from 'vite';
import Checker from 'vite-plugin-checker';
import svgr from "vite-plugin-svgr";
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    Checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint --no-ignore --ext .ts,.tsx src',
        useFlatConfig: true,
      },
      enableBuild: false
    }),
  ],
  clearScreen: false,
  server: {
    port: 3000,
    host: true,
    open: true,
    hmr: {
      overlay: true,
    },
    // https: {
    //   key: fs.readFileSync('./.cert/key.pem'),
    //   cert: fs.readFileSync('./.cert/cert.pem'),
    // },
  },
  preview: {
    port: 4174,
    host: true,
    // https: {
    //   key: fs.readFileSync('./.cert/key.pem'),
    //   cert: fs.readFileSync('./.cert/cert.pem'),
    // },
  },
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(new URL(import.meta.url).pathname), "src"),
    },
  }
});
