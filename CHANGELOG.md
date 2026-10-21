<!-- markdownlint-disable MD024 -->

# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased] · 2026-10-22

> 2026-10-21 审核驱动闭环修复；2026-10-22 路线①（自建账号）实现与 NAS 生产上线闭环。

### Added

- **自建账号体系（路线①，零新依赖）**：[server/local.js](./server/local.js) 以 Node 内置 crypto 实现闭环登录——
  账号存 MySQL `auth_user` 表（[server/db.js](./server/db.js) `ensureSchema()` 启动自动建表），
  密码 scrypt 散列（N=16384/r=8/p=1，16B 盐 + 64B 派生），会话 HS256 JWT 存 HttpOnly cookie（`bgl_lid`，30 天）；
  服务端渲染中文登录页（零外部资源、noindex），错密码/锁定/存储故障区分 401/429/503。
  与 kimi/header/JWT 三种鉴权互斥共存（[server/auth.js](./server/auth.js) 探测链 kimi → local → header → JWT），
  前端零改动复用既有跳登出逻辑。
- **家人账号管理 CLI**：[scripts/user.mjs](./scripts/user.mjs) 支持
  `add / passwd / list / enable / disable / rm`，密码经 `BGL_USER_PWD` 环境变量传入（不进 argv 与 shell 历史）。
- **NAS 生产部署产物与运维手册**：[deploy/start.sh](./deploy/start.sh)（flock 防并发 + healthz 幂等的看门狗脚本，
  配合 crontab `@reboot` + `*/5` 实现无 root 自愈）；
  [ops/OPERATIONS.md](./ops/OPERATIONS.md) 权威运维手册（拓扑/端口决策/发布回滚/账号管理/备份恢复/故障排查表/安全基线）。
  生产实测：NAS `192.168.3.45:3030` 上线，登录-会话-登出全链路通过，恢复演练通过。

### Security

- **自建登录三重防护**：同 IP 连错 8 次锁 15 分钟（内存态，直连地址为键，不信 X-Forwarded-For）；
  带 Origin 的表单 POST 强制同源校验（防 login CSRF）；账号不存在也跑等价 scrypt（抹平计时侧信道）。

### Changed

- [deploy/backup.sh](./deploy/backup.sh)：dump 客户端动态解析（`MYSQLDUMP_BIN` 显式指定 → `mysqldump` → `mariadb-dump`），
  适配 fnOS/NAS 应用自装 MySQL 的 PATH 缺失场景。
- [deploy/.env.example](./deploy/.env.example)：补 `AUTH_LOCAL_SECRET` 与备份配置项；
  端口说明对齐团队约定（3030 起；NAS 实测 3000/3100 已被既有容器占用）。
- [deploy/README.md](./deploy/README.md)：标注方案 B 无 root 落地形态（指向 ops/OPERATIONS.md）、
  鉴权表扩为四选一、备份章节更新为已上线并演练。
- 服务器未配置鉴权时的日志文案更新为四选项提示（`kimi / AUTH_LOCAL_SECRET / AUTH_HEADER_USER / AUTH_JWKS_URL`）。

- **CI 质量门禁与 GitHub Pages 自动化部署（[.github/workflows/](./.github/workflows/)）**：
  [ci.yml](./.github/workflows/ci.yml) 在 push/PR 时执行双形态构建、静态产物纯净性断言
  （零 `/api` 字符串、CNAME 与 `.nojekyll` 就位）与无库服务端冒烟（`/healthz` 必须如实返回 `db:false`）；
  [pages.yml](./.github/workflows/pages.yml) 推送 `main` 自动构建静态站并以 OIDC 发布至
  GitHub Pages 自定义域名 [mc.yyc3.vip](https://mc.yyc3.vip)。
- **仓库可见性**：GitHub topics 标签与 [README.md](./README.md) 关键词行、Pages 部署形态行。
- **阶段总结与衔接文档**：[docs/0379-baby-mochen-impl-20261021/](./docs/0379-baby-mochen-impl-20261021/03-总结文档与状态同步.md)
  四件套（审核报告 / 任务规划 / 执行日志 / 总结衔接）。
- **落地上线指导方案与部署产物（[deploy/](./deploy/README.md)）**：
  基于现网实测拓扑（ECS yyc3-202 公网 / NAS yyc3-45 内网 fnOS / Mac yyc3-22 主库）输出双方案——
  ECS `docker compose`（Caddy 自动 HTTPS + MySQL 8.4）与裸机 `systemd`（NAS 实测无 docker，MariaDB 10.3 直连）；
  含数据库开通、鉴权接入三选一、上线验收清单、备份容灾（[backup.sh](./deploy/backup.sh)）
  与安全风险表。部署最小集仅 `dist-server/boot.js`（esbuild 自包含，mysql2 已内联）+ `dist/`。
- **NAS 应用库端到端验证**：NAS MariaDB（192.168.3.45:3306）新建 `yyc3_baby_mochen`
  库与专用最小权限账号 `bgl`，`ensureSchema()` 自动建表，
  `/healthz {"ok":true,"db":true}`、状态 PUT/GET 回环、过期 revision 409 拦截全部通过（测试数据已清理）。
- **GitHub 仓库登记**：[README.md](./README.md) 顶部徽章与项目属性表登记
  [github.com/YYC-Cube/YYC3-Baby-MoChen](https://github.com/YYC-Cube/YYC3-Baby-MoChen)。

### Fixed

- **静态打包失效（P1 阻断项）**：`npm run build` 脚本内联的 `BUILD_TARGET=fullstack` 会覆盖
  [scripts/bundle.mjs](./scripts/bundle.mjs) 传入的环境变量（shell 内联赋值优先级高于继承 env），
  导致静态包里残留远端同步逻辑，请求不存在的 `/healthz`、`/api/state`。
  新增 `build:static` 脚本，`bundle.mjs` 按 `static` / `fullstack` 形态分别走 `build:static` / `build`。
- **静态产物残留 `/api` 死代码**：[`src/remote.js`](./src/remote.js) 原本只有 `probe()`
  带编译期守卫，`pullState` / `pushState` / `putPhotoBlob` / `dropPhotoBlob` / `photoUrl`
  是无条件导出，esbuild 的 DCE 无法跨函数边界消除，静态包里仍含 `/api/*` 请求代码。
  五个函数统一补上 `if (!__SHARED_BACKEND__)` 守卫（调用点均在 `probe()` / `shared`
  运行时守卫之下，行为不变），静态产物现已零 `/api` 字符串、零应用层 `fetch`。

### Security

- **照片接口 MIME 白名单**：上传方声明的 `Content-Type` 不可信，
  [`server/index.js`](./server/index.js) 入库前按白名单
  （`image/jpeg` / `image/png` / `image/webp` / `image/gif`）校验，白名单外返回 `415`（并排空请求体）；
  白名单外的存量记录读取时兜底为 `application/octet-stream`（[`server/db.js`](./server/db.js) 导出 `PHOTO_MIME`）。
- **全响应 `nosniff`**：`send()` 统一附带 `X-Content-Type-Options: nosniff`，
  防止用户上传内容被浏览器嗅探成可执行类型。
- **Bearer JWT 验签落地**：[`server/kimi.js`](./server/kimi.js) 抽出可复用的
  `fetchJwks()` / `verifyJws()`（RS256 / ES256 / ES384 / ES512，IEEE P1363，含 `exp` 校验），
  [`server/auth.js`](./server/auth.js) 的 `verifyToken()` 由固定返回 `false` 的占位实现
  改为真实验签（JWKS 公钥缓存 10 分钟，拉取失败失败关闭）。

### Changed

- `serve.sh` 开发端口对齐团队约定 `3030` 起（原 `8790`）。
- `react` / `react-dom` 由 `latest` 锁定为 `^19.2.8`，构建可复现。
- [README.md](./README.md)：补 `build:static` 脚本、`AUTH_JWKS_URL` 说明、
  服务端防护表（照片白名单 / nosniff / Bearer JWT 验签）、文档地图入 `CHANGELOG`。
- [SECURITY.md](./SECURITY.md)：安全设计表新增 Bearer JWT 验签与照片 MIME 白名单；
  已知限制移除已修复的 2 项并重新编号；部署清单新增 `aud` / `iss` 校验提示。
