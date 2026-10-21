// 把服务端打成一个自包含的 ESM 单文件：平台运行时不做 npm install，
// 依赖必须提前内联。
//
// banner 里补一个 createRequire：mysql2 及其依赖是 CJS，内部有少量
// require("node:buffer") 这类调用；esbuild 输出 ESM 时会把它们替换成一个
// 会抛 "Dynamic require ... is not supported" 的 shim，必须把真正的
// require 还回去，否则进程启动即崩。
import { build } from "esbuild";

const BANNER = [
  'import { createRequire as __nodeCreateRequire } from "node:module";',
  "const require = __nodeCreateRequire(import.meta.url);",
].join("\n");

await build({
  entryPoints: ["server/index.js"],
  outfile: "dist-server/boot.js",
  bundle: true,
  platform: "node",
  target: "node20.11",
  format: "esm",
  banner: { js: BANNER },
  logLevel: "info",
});
