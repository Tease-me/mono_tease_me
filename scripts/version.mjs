import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const packageJsonPath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");
const publicVersionPath = path.join(rootDir, "public", "version.json");

const command = process.argv[2];
const explicitVersion = process.argv[3];

const usage = [
  "Usage:",
  "  node scripts/version.mjs sync",
  "  node scripts/version.mjs patch",
  "  node scripts/version.mjs minor",
  "  node scripts/version.mjs major",
  "  node scripts/version.mjs set <x.y.z>",
].join("\n");

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Unsupported version format: ${version}. Expected x.y.z`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(version, releaseType) {
  const parsed = parseSemver(version);

  switch (releaseType) {
    case "patch":
      return formatSemver({
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch + 1,
      });
    case "minor":
      return formatSemver({
        major: parsed.major,
        minor: parsed.minor + 1,
        patch: 0,
      });
    case "major":
      return formatSemver({
        major: parsed.major + 1,
        minor: 0,
        patch: 0,
      });
    default:
      throw new Error(`Unsupported release type: ${releaseType}`);
  }
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function syncArtifacts(version, packageName) {
  const packageLock = await readJson(packageLockPath);
  packageLock.version = version;

  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = version;
  }

  await writeJson(packageLockPath, packageLock);

  await writeJson(publicVersionPath, {
    name: packageName,
    version,
  });
}

async function main() {
  if (!command) {
    throw new Error(usage);
  }

  const packageJson = await readJson(packageJsonPath);
  const currentVersion = packageJson.version;

  let nextVersion = currentVersion;

  if (command === "sync") {
    await syncArtifacts(currentVersion, packageJson.name);
    console.log(`Version metadata synced: ${currentVersion}`);
    return;
  }

  if (command === "set") {
    if (!explicitVersion) {
      throw new Error("Missing version value.\n\n" + usage);
    }
    parseSemver(explicitVersion);
    nextVersion = explicitVersion;
  } else if (command === "patch" || command === "minor" || command === "major") {
    nextVersion = bumpVersion(currentVersion, command);
  } else {
    throw new Error(usage);
  }

  packageJson.version = nextVersion;
  await writeJson(packageJsonPath, packageJson);
  await syncArtifacts(nextVersion, packageJson.name);

  console.log(`Version updated: ${currentVersion} -> ${nextVersion}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
