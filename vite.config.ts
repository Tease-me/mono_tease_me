import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import Checker from "vite-plugin-checker";
import svgr from "vite-plugin-svgr";
import fs from "fs";
import packageJson from "./package.json";

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const appVersion = packageJson.version;
  const hasCert =
    fs.existsSync("./.cert/key.pem") && fs.existsSync("./.cert/cert.pem");
  const httpsConfig =
    !isBuild && hasCert
      ? {
          key: fs.readFileSync("./.cert/key.pem"),
          cert: fs.readFileSync("./.cert/cert.pem"),
        }
      : undefined;

  return {
    plugins: [
      react(),
      svgr(),
      Checker({
        typescript: true,
        eslint: {
          lintCommand: "eslint --no-ignore --ext .ts,.tsx src",
          useFlatConfig: true,
        },
        enableBuild: false,
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
      https: httpsConfig,
    },
    preview: {
      port: 4174,
      host: true,
      https: httpsConfig,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
  };
});
