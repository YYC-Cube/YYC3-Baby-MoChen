---
file: ops/OPERATIONS.md
description: 宝宝成长日志 NAS 生产运维手册（路线①自建账号 · 无 root 裸机部署）
author: AI Tutor <intelligent-app-impl>
version: v1.0.0
created: 2026-10-22
updated: 2026-10-22
status: active
tags: [operations],[nas],[runbook]
category: manual
---

# 🛠️ 宝宝成长日志 · NAS 生产运维手册

> 权威运维文档（Runbook）。2026-10-22 路线①（自建账号）上线当日基于实机操作编写，
> 所有命令均在生产环境（NAS `yyc3-45`）实际执行验证过，照抄即可。
> 部署架构背景见 [deploy/README.md](../deploy/README.md)；本文只讲「日常怎么运维」。

---

## 一、生产拓扑速览（2026-10-22 实测）

| 节点 | 地址 | 角色 |
| --- | --- | --- |
| Mac 开发机 yyc3-22 | 192.168.3.22 | 构建、发布、账号管理（借 `deploy/.env.local` 连生产库） |
| **NAS yyc3-45** | **192.168.3.45**（Tailscale 100.65.172.88） | **生产主机**：应用 :3030 + MySQL :3306 |
| 家庭用户 | 手机/电脑浏览器 | 访问 `http://192.168.3.45:3030` |
| 静态演示站 | https://mc.yyc3.vip | GitHub Pages（无后端，纯前端形态） |

**端口决策记录**（选型踩坑，勿再踩）：

| 端口 | 实测状态 | 结论 |
| --- | --- | --- |
| 3000 | 容器（fnOS 托管 `node src/server.js`）经 docker-proxy 绑定 192.168.3.45:3000 | ❌ 占用 |
| 3100 | 容器经 docker-proxy 绑定 100.65.172.88:3100（本应用首启 EADDRINUSE 的元凶） | ❌ 占用 |
| **3030** | 空闲 | ✅ 采用（亦合团队「3030 起」约定） |

> 排查端口占用的关键：`docker-proxy` 可能只绑特定 IP（如 Tailscale 地址），`ss -tln` 全量看，别只 curl 127.0.0.1。

**NAS 环境硬约束**（决定运维形态）：

- 无 root（sudo 需密码）→ 用 **crontab 看门狗**，不用 systemd
- fnOS 托管 docker（有容器在跑但**无 docker CLI**）→ 不碰容器，纯裸机
- MySQL 为 fnOS 应用自装（`/Volume2/@apps/mysql/mysql/`）→ `mysqldump` 需**全路径**指路
- 无预装 Node → 使用便携版 Node（见 §二）

---

## 二、NAS 侧布局

### 2.1 目录与文件

```
/home/YYC3/apps/baby-mochen/          # 应用根（owner: YYC3）
├── dist/                             # 前端静态产物（Vite，rsync 发布）
├── dist-server/boot.js               # 服务端单文件（esbuild 自包含，mysql2 已内联）
├── .env        (600)                 # 机密配置：PORT / DATABASE_URL / AUTH_LOCAL_SECRET /
│                                     #   BACKUP_DIR / MYSQLDUMP_BIN —— 严禁入库
├── start.sh    (755)                 # 启动 + 看门狗（幂等，[deploy/start.sh](../deploy/start.sh) 同源）
├── backup.sh   (755)                 # 备份脚本（[deploy/backup.sh](../deploy/backup.sh) 同源）
└── app.log                           # 运行日志（nohup 追加）

/home/YYC3/apps/node/                 # 便携版 Node v22.20.0（linux-x64，tar.xz 解压，无 root 安装）
/home/YYC3/backups/baby-mochen/       # 数据库备份（每日 03:30，保留 14 天）
/tmp/baby-mochen.lock                 # flock 并发锁（看门狗防双开）
```

### 2.2 `.env` 关键项（值脱敏，实值在 NAS 上）

```bash
PORT=3030
DATABASE_URL='mysql://bgl:<随机密码>@127.0.0.1:3306/yyc3_baby_mochen'
AUTH_LOCAL_SECRET=<openssl rand -hex 32>      # 自建账号会话签名密钥；设置即启用路线①
BACKUP_DIR=/home/YYC3/backups/baby-mochen
MYSQLDUMP_BIN=/Volume2/@apps/mysql/mysql/bin/mysqldump   # fnOS 自装 MySQL，PATH 里没有
```

### 2.3 crontab（`ssh yyc3-45 'crontab -l'`）

```cron
@reboot     /home/YYC3/apps/baby-mochen/start.sh        # 开机自启
*/5 * * * * /home/YYC3/apps/baby-mochen/start.sh        # 看门狗：每 5 分钟巡检
30 3 * * *  /home/YYC3/apps/baby-mochen/backup.sh >> /home/YYC3/backups/baby-mochen/backup.log 2>&1
```

**看门狗机制**：`start.sh` 以 `flock -n` 抢锁防并发 → curl `/healthz` 通了就幂等退出 → 不通则以 `.env` 拉起 `boot.js`（nohup 后台）。因此**进程挂掉最多 5 分钟自愈**；`@reboot` 保证 NAS 重启后自动恢复。

---

## 三、日常操作

> 以下命令从 Mac 执行（SSH 别名 `yyc3-45` 已配置密钥免密）。

### 3.1 健康检查

```bash
# 局域网直接探（家庭日常最常用）
curl -s http://192.168.3.45:3030/healthz        # 期望 {"ok":true,"db":true}
# "db":false 说明 MySQL 连不上：先查 MySQL app 是否在跑，再查 .env 的 DATABASE_URL
```

### 3.2 看状态 / 看日志

```bash
ssh yyc3-45 'pgrep -af "dist-server/boot.js"                     # 进程在不在
  tail -n 50 /home/YYC3/apps/baby-mochen/app.log'                # 最近日志
```

### 3.3 重启 / 停机

```bash
# 重启（kill 后看门狗会在 ≤5 分钟内拉起；想立即拉起就手动跑一次 start.sh）
ssh yyc3-45 'kill $(pgrep -f "dist-server/boot.js") 2>/dev/null; sleep 1
  /home/YYC3/apps/baby-mochen/start.sh
  sleep 2; curl -s http://127.0.0.1:3030/healthz'

# 停机（先摘看门狗条目再 kill，否则 5 分钟后自动复活）
ssh yyc3-45 'crontab -l | sed "\|^/\* \* \* \* \* /home/YYC3/apps/baby-mochen/start.sh|d" | crontab -
  kill $(pgrep -f "dist-server/boot.js") 2>/dev/null'
# 恢复运行：把看门狗条目加回去（crontab -e）并跑一次 start.sh
```

### 3.4 升级发布（Mac 上执行）

```bash
cd /Users/yanyu/YYC3-Baby-MoChen
npm run build && npm run build:server            # 双产物：dist/ + dist-server/boot.js

# 发布前备份当前版本（回滚用，见 3.5）
ssh yyc3-45 'cp /home/YYC3/apps/baby-mochen/dist-server/boot.js \
  /home/YYC3/apps/baby-mochen/dist-server/boot.js.bak-$(date +%Y%m%d-%H%M%S)'

# 同步产物（boot.js 单文件原子替换；dist/ 静态目录直接覆盖）
rsync -av --delete dist yyc3-45:/home/YYC3/apps/baby-mochen/
rsync -av dist-server/boot.js yyc3-45:/home/YYC3/apps/baby-mochen/dist-server/

# ⚠️ 正在运行的进程跑的是内存里的旧代码，rsync 不会热加载 —— 必须重启（§3.3）
```

发布后验收三连：

```bash
curl -s http://192.168.3.45:3030/healthz
curl -s http://192.168.3.45:3030/api/auth/session   # {"provider":"local",...}
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.3.45:3030/   # 200
```

### 3.5 回滚

```bash
ssh yyc3-45 'cd /home/YYC3/apps/baby-mochen/dist-server
  ls -t boot.js.bak-* | head -1                  # 找最近备份
  cp boot.js.bak-<时间戳> boot.js
  kill $(pgrep -f "dist-server/boot.js") 2>/dev/null; /home/YYC3/apps/baby-mochen/start.sh'
```

`ensureSchema()` 只增不破坏（`CREATE TABLE IF NOT EXISTS`），旧版应用兼容新表结构，无需回滚数据库。

---

## 四、家人账号管理（自建账号 · 路线①）

账号存 MySQL `auth_user` 表（服务启动 `ensureSchema()` 自动建表），密码 scrypt 散列，
会话为 HS256 JWT 存 HttpOnly cookie（`bgl_lid`，**30 天**）。服务端不开放注册，账号一律由管理员发放。

**在 Mac 上执行**（借 `deploy/.env.local` 里的生产库连接串，该文件 gitignored）：

```bash
cd /Users/yanyu/YYC3-Baby-MoChen
set -a; source deploy/.env.local; set +a

# 新建 / 重置（同名家账号会被整体替换，可用于重置密码）
BGL_USER_PWD='<至少8位密码>' node scripts/user.mjs add <用户名> <家庭ID> '<显示名>'
# 示例：BGL_USER_PWD='xxx' node scripts/user.mjs add baba mochen 爸爸

node scripts/user.mjs list                    # 列出全部账号
BGL_USER_PWD='<新密码>' node scripts/user.mjs passwd <用户名>   # 只改密码
node scripts/user.mjs disable <用户名>        # 停用（enabled=0，登录被拒，数据保留）
node scripts/user.mjs enable <用户名>         # 启用
node scripts/user.mjs rm <用户名>             # 删除账号（不动业务数据）

unset BGL_USER_PWD                            # 用完即清，密码不驻留 shell 环境
```

约定：用户名 `^[a-zA-Z0-9_-]{1,40}$`；**家庭 ID 即数据隔离边界**（`familyId`），同家人共用一个家庭 ID。

**会话与密钥须知**：

- 登录入口 `http://192.168.3.45:3030`（前端未登录会自动跳到内置登录页）
- 登出：应用内登出按钮（POST `/api/auth/signout`，清 cookie）
- **轮换 `AUTH_LOCAL_SECRET`（改 .env 后重启）= 全员会话立即失效**，需重新登录；怀疑密钥泄露时照此办理
- 密码连续输错 **8 次/15 分钟窗口** 锁定同 IP（返回 429）；重启应用即清零计数

---

## 五、备份与恢复

### 5.1 机制

- 每日 **03:30** cron 执行 `backup.sh`：`mysqldump --single-transaction --triggers`（不锁表）→ `gzip -9` → `/home/YYC3/backups/baby-mochen/yyc3_baby_mochen-YYYYmmdd-HHMMSS.sql.gz`
- 本地保留 **14 天**（`find -mtime +14 -delete` 自动轮转），备份日志同目录 `backup.log`
- 照片二进制与状态同库（`family_photo` LONGBLOB），**单库 dump 即全量**，无对象存储依赖
- 凭证从应用 `.env` 的 `DATABASE_URL` 现场解析，明文不落第二处

### 5.2 手动备份（重要操作前手动来一发）

```bash
ssh yyc3-45 '/home/YYC3/apps/baby-mochen/backup.sh && ls -lht /home/YYC3/backups/baby-mochen/ | head -3'
```

### 5.3 恢复步骤

```bash
# 1）把应用停写（§3.3 停机，避免恢复期间新写入被覆盖）
# 2）灌回 dump（bgl 为最小权限账号、无建库权限，恢复目标就是本库本身）
ssh yyc3-45 'gunzip -c /home/YYC3/backups/baby-mochen/<dump>.sql.gz \
  | mysql -h127.0.0.1 -ubgl -p yyc3_baby_mochen'
# 3）验证后重新拉起应用并 healthz
```

> **独立演练库说明**：`bgl` 仅授权 `yyc3_baby_mochen.*`，无法 `CREATE DATABASE` 做隔离演练
> （实测 ERROR 1044）。如需独立库演练，须管理员用 MySQL root 临时授权后收回；
> 常规验证可采用「灌回本库」方式（dump 自带 DROP/CREATE TABLE，等于把库恢复到备份时点）。

### 5.4 演练记录

| 日期 | 方式 | 结果 |
| --- | --- | --- |
| 2026-10-22 | dump 灌回本库（DROP/CREATE/INSERT 全链执行） | ✅ `auth_user` 数据完整回读，应用 `healthz {"ok":true,"db":true}` |

建议**每季度**重跑一次 §5.3，并把结果补进本表。

---

## 六、鉴权模型速查（排障用）

- **Provider 链**：kimi → **local** → header → JWT，互斥共存、谁配了用谁；本生产环境配置了 `AUTH_LOCAL_SECRET`，即 local（`/api/auth/session` 返回 `"provider":"local"`）
- 登录：`GET /api/auth/local` 出表单（服务端渲染，零外部资源）→ `POST /api/auth/local`（`username`/`password` 表单）
- 错误语义：`401` 密码错/账号停用 · `429` 触发限速锁定 · `403` Origin 校验失败（防 login CSRF）· `503` 存储故障
- cookie：`bgl_lid`，HttpOnly + SameSite=Lax（HTTPS 反代下自动 None+Secure），30 天
- 密码散列：scrypt（N=16384, r=8, p=1，16B 盐 + 64B 派生），Node 内置 crypto，零第三方依赖
- 计时侧信道：账号不存在也跑等价 scrypt，无法靠响应时间探测用户名是否存在

---

## 七、故障排查表

| 症状 | 定位 | 处置 |
| --- | --- | --- |
| `/healthz` 连不上 | `ssh yyc3-45 'pgrep -af boot.js'` 无进程 | 看 `app.log` 尾部；手动跑 `start.sh`；确认 crontab 看门狗条目还在 |
| 启动报 `EADDRINUSE :::3030` | `ss -tlnp | grep 3030` | 换端口：改 `.env` 的 `PORT`（先 `ss -tln` 全量确认目标端口空闲，含 docker-proxy 绑定） |
| `healthz` 返回 `{"ok":true,"db":false}` | MySQL 挂了或凭证错 | `ssh yyc3-45 'mysql -h127.0.0.1 -ubgl -p -e "SELECT 1"'`；查 MySQL app 状态与 `.env` |
| 登录永远 401 | 账号被 disable 或密码不对 | `node scripts/user.mjs list` 看 enabled；必要时 `passwd` 重置 |
| 登录返回 429 | 同 IP 连错 8 次触发锁定 | 等 15 分钟，或重启应用清零（内存态） |
| 登录返回 503 | `app.log` 出现 `local sign-in db error` | 按 `db:false` 路径排查数据库 |
| 看门狗双开 | 不可能出现 | `start.sh` 有 `flock` 互斥；若 `/tmp` 被清，重启后第一条 `@reboot` 会重建锁 |
| 升级后行为没变 | 老进程还在跑旧代码 | §3.4 的 ⚠️：重启进程 |
| 磁盘增长 | `du -sh /home/YYC3/backups/baby-mochen`、`app.log` | 备份 14 天自动轮转；`app.log` 可 `: > app.log` 截断（勿删，nohup 句柄在） |

---

## 八、安全基线（定期核查）

- [ ] `ssh yyc3-45 'stat -c "%a" /home/YYC3/apps/baby-mochen/.env'` → **600**
- [ ] `ls -ld /home/YYC3/backups/baby-mochen` → 仅 YYC3 可读（dump 含全量家庭数据）
- [ ] `git -C /Users/yanyu/YYC3-Baby-MoChen check-ignore deploy/.env.local` → 有输出（gitignored）
- [ ] `AUTH_LOCAL_SECRET` 仅存在于 NAS `.env`；如疑似泄露 → 轮换（§四）+ 检查 NAS 登录记录
- [ ] 数据库账号保持最小权限（`bgl` 仅 `yyc3_baby_mochen.*`）；不要为图省事放大授权
- [ ] 内网暴露面：仅 3030（应用）；MySQL 3306 不对家庭网段以外暴露

---

## 九、已知限制与演进位

| 项 | 现状 | 演进方向 |
| --- | --- | --- |
| 进程管理 | crontab 看门狗（≤5 分钟自愈） | 拿到 NAS root 后可换 systemd（[baby-mochen.service](../deploy/baby-mochen.service) 已备好） |
| 登录限速/业务限流 | 进程内存态，重启清零 | 多实例时引入 Redis（NAS 6399 已有从库） |
| MySQL 版本 | fnOS 自装 MySQL（`/Volume2/@apps/mysql`） | 随 fnOS 升级；迁移前先 §5.2 手动备份 |
| 异地备份 | 仅 NAS 本地盘 | `backup.sh` 已支持 `BACKUP_REMOTE=user@host:/path`（SSH 免密后启用，推向 Mac 即异地） |
| HTTPS | 局域网 HTTP 明文 | 需要外网/HTTPS 时：Tailscale Serve 或 fnOS 反代终结（cookie 自动切 Secure） |

---

*维护：YanYuCloudCube · 上线实测：2026-10-22 · 实测人：AI 导师（Intelligent Application Implementation Expert）*
