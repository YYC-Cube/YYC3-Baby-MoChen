// 打包成 sitepub 能收的 zip。两种形态共用一套产物：
//   static    —— 只有前端，zip 根是 index.html
//   fullstack —— 前端 + 内联好的服务端，zip 根有 bootstrap / boot.js / package.json
// 「发布给人看的模版」也用 fullstack 包：演示不留痕是运行时的演示模式
// （落地页「体验」入口），不再需要一个单独的编译形态。
// 平台运行时不做 npm install，所以服务端依赖必须用 esbuild 内联进单文件。
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const kind = process.argv[2] === "static" ? "static" : "fullstack";
const slug = process.argv[3] || "baby-growth-log";
const stage = join(ROOT, ".bundle", kind);
const outZip = join(ROOT, ".bundle", `${slug}-${kind}.zip`);

function run(cmd, args, { cwd = ROOT, env = {} } = {}) {
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

// 只清掉本形态的暂存目录和 zip，两种形态可以同时留在 .bundle 里各自备查。
rmSync(stage, { recursive: true, force: true });
rmSync(outZip, { force: true });
mkdirSync(stage, { recursive: true });

// 前端要按形态构建：只有 fullstack 的产物里才保留共享存储那段代码，
// 静态产物构建时会被摇掉，线上不会去请求根本不存在的 /healthz。
console.log(`> building frontend (${kind})`);
// 静态形态必须走 build:static：build 脚本里内联的 BUILD_TARGET=fullstack
// 会覆盖这里传入的环境变量，导致静态包里带上远端同步逻辑（历史坑）。
// fullstack 走 build，同时产出 boot 入口；显式传 env 保持两种调用方式等价。
run("npm", kind === "static" ? ["run", "build:static"] : ["run", "build"], {
  env: { BUILD_TARGET: kind },
});
if (!existsSync(join(ROOT, "dist", "index.html"))) {
  throw new Error("dist/index.html is missing — frontend build failed");
}

if (kind === "static") {
  // 静态站：zip 根即站点根，直接把 dist 的内容摊平进来。
  cpSync(join(ROOT, "dist"), stage, { recursive: true });
} else {
  console.log("> bundling server");
  run("npm", ["run", "build:server"]);
  cpSync(join(ROOT, "dist"), join(stage, "dist"), { recursive: true });
  cpSync(join(ROOT, "dist-server", "boot.js"), join(stage, "boot.js"));
  cpSync(join(ROOT, "bootstrap"), join(stage, "bootstrap"));
  // 入口是 ESM，包里必须带 type: module，否则 Node 按 CJS 解析、启动即 SyntaxError。
  writeFileSync(
    join(stage, "package.json"),
    JSON.stringify({ name: "baby-growth-log", private: true, type: "module" }, null, 2) + "\n",
  );
}

const bytes = dirSize(stage);
console.log(`> staged ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
if (bytes > 64 * 1024 * 1024) {
  throw new Error("bundle exceeds the 64 MiB limit");
}

console.log("> zipping");
// zip 会保留 bootstrap 的可执行位
run("zip", ["-qr", outZip, ".", "-x", ".DS_Store", "-x", "__MACOSX/*"], { cwd: stage });

console.log(`\nbundle ready: ${outZip}`);
console.log(
  kind === "static"
    ? `next: sitepub publish ${slug} ${outZip}`
    : `next: sitepub env ${slug} --out /tmp/${slug}.env\n      sitepub publish ${slug} ${outZip} --kind fullstack`,
);
