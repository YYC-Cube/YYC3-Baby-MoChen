// 全栈形态的构建入口：先做前端 build（带 BUILD_TARGET=fullstack），
// 再把服务端打进产物里。
//
// 为什么要有这个脚本：原来的写法是 `BUILD_TARGET=fullstack vite build ...`，
// 那是 POSIX shell 的语法，Windows 的 cmd/PowerShell 会直接报
// 「'BUILD_TARGET' 不是内部或外部命令」。把环境变量在这里设好再 spawn，
// 三平台行为就一致了。
//
// 用法：
//   node scripts/build-fullstack.mjs            → dist/ 前端 + dist/boot.js（平台发布用）
//   node scripts/build-fullstack.mjs --server   → dist/ 前端 + dist-server/boot.js（Docker/自托管用）
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverOnly = process.argv.includes("--server");

process.env.BUILD_TARGET = "fullstack";

function run(args) {
  // 全程只调 node 本体（不依赖 .cmd 包装），因此不需要 shell；
  // 开着 shell 反而会把参数拼成命令行，路径带空格时容易出问题。
  const result = spawnSync(args[0], args.slice(1), {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(["node", join(root, "node_modules", "vite", "bin", "vite.js"), "build"]);
run(["node", join(root, "scripts", serverOnly ? "build-server.mjs" : "build-boot.mjs")]);

console.log(serverOnly ? "dist/ + dist-server/boot.js ready" : "dist/ + dist/boot.js ready");
