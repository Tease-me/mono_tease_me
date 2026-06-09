const homeDir = process.env.HOME || "";
const appDir = process.env.STAGING_APP_DIR || `${homeDir}/tease-me-staging`;
const port = process.env.STAGING_PORT || "4173";

module.exports = {
  apps: [
    {
      name: "tease-me-staging",
      cwd: appDir,
      script: "./scripts/serve-dist.sh",
      interpreter: "none",
      env: {
        PORT: port,
        HOST: "0.0.0.0",
        DIST_DIR: `${appDir}/dist`,
      },
    },
  ],
};
