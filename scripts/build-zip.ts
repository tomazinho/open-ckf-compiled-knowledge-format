// Builds open-ckf.zip from the open-ckf/ directory (excluding node_modules, dist, .zip).
// Usage: bun run open-ckf/scripts/build-zip.ts
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const OUT_DIR = "/mnt/documents";
const OUT = `${OUT_DIR}/open-ckf.zip`;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(OUT)) rmSync(OUT);

const args = [
  "-r",
  OUT,
  ".",
  "-x",
  "*/node_modules/*",
  "*/dist/*",
  "*.zip",
  "*/.vite/*",
];

const res = spawnSync("zip", args, { cwd: ROOT, stdio: "inherit" });
if (res.status !== 0) {
  console.error("zip failed", res.status);
  process.exit(res.status ?? 1);
}
console.log(`✓ Built ${OUT}`);
