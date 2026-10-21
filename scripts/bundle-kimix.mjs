// 打成 kimix 全栈站要的包：zip 根是源树（index.html 在根、Dockerfile 在根），
// 平台侧自己跑 Docker 构建（npm ci → vite build + esbuild 服务端 → npm start）。
// 和 bundle.mjs 的 sitepub 形态完全不同：那边是自包含运行时，这边是源 + Dockerfile。
// .dockerignore 已排除 dist/dist-server/node_modules，zip 也不带它们。
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const slug = process.argv[2] || "baby-growth-log";
const stage = join(ROOT, ".bundle", "kimix");
const outZip = join(ROOT, ".bundle", `${slug}-kimix.zip`);

function run(cmd, args, cwd = ROOT) {
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

const COPY = [
  "index.html",
  "package.json",
  "package-lock.json",
  "vite.config.js",
  "Dockerfile",
  ".dockerignore",
  ".backend-features.json",
  ".env.example",
  "src",
  "server",
  "scripts",
  "public",
];

for (const name of ["Dockerfile", ".backend-features.json", "package-lock.json"]) {
  if (!existsSync(join(ROOT, name))) throw new Error(`${name} is missing`);
}

rmSync(stage, { recursive: true, force: true });
rmSync(outZip, { force: true });
mkdirSync(stage, { recursive: true });

for (const name of COPY) {
  const src = join(ROOT, name);
  if (!existsSync(src)) throw new Error(`${name} is missing`);
  execFileSync("cp", ["-R", src, join(stage, name)], { stdio: "inherit" });
}

const bytes = dirSize(stage);
console.log(`> staged ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
if (bytes > 64 * 1024 * 1024) throw new Error("bundle exceeds the 64 MiB limit");

run("zip", ["-qr", outZip, ".", "-x", ".DS_Store", "-x", "__MACOSX/*"], stage);
console.log(`\nbundle ready: ${outZip}`);
console.log(`next: kimix website validate fullstack ${outZip}`);
