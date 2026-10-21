# YYC3-Baby-MoChen 完整落地上线指导方案

> 基于现网实测（2026-10-21）的部署方案。所有端口、版本、连通性均为当日巡检真实结果，非假设值。

---

## 一、部署物与最小集

服务端 `dist-server/boot.js` 为 esbuild **自包含单文件**（`mysql2` 已内联，运行时无需 `node_modules`），配合前端静态产物 `dist/`，部署最小集只有两件：

```
dist-server/boot.js   # 全栈服务端（约 1.4MB），自动发现静态目录
dist/                 # Vite 前端产物（boot.js 依次尝试 ../dist 与 ./dist，可用 STATIC_DIR 覆盖）
```

本机构建：

```bash
npm run build            # BUILD_TARGET=fullstack vite build → dist/
npm run build:server     # esbuild → dist-server/boot.js
```

---

## 二、现网拓扑（实测）

```
                       公网
        ┌──────────────────────────────┐
        │  ECS yyc3-202 (47.94.135.202)│  ← 推荐公网入口（方案 A/B）
        │  Caddy :443 → app :3000      │
        └──────────────┬───────────────┘
                       │ DATABASE_URL
        ═══════════════╪═══════════════  Tailscale / LAN
                       │
   ┌───────────────────┴─────────────────────┐
   │ NAS yyc3-45（fnOS）                     │
   │  192.168.3.45 / Tailscale 100.65.172.88 │
   │  SSH: YYC3@…:9557（密钥 id_ed25519）     │
   ├─────────────────────────────────────────┤
   │ MariaDB 10.3.28 原生安装 :3306           │  ← 应用库 yyc3_baby_mochen 已建（见 §3）
   │   max_allowed_packet=100MB ✅ 满足 12MB 照片 │
   │ PG 备库 :5433（只读镜像，lag≈0）          │
   │ PG 知识库 :5434（yyc3_kb，vector 0.8.2）  │
   │ Redis :6399（slave → 192.168.3.22:6379 up）│
   │ ⚠️ 无 docker CLI（实测 command -v docker 无结果）│
   └───────────────────┬─────────────────────┘
                       │ PG 流复制
        ┌──────────────┴───────────────┐
        │ Mac 主库 yyc3-22 (192.168.3.22)│
        │ PostgreSQL 15.15 :5433         │
        │ 13 业务库 602 表 ~184MB          │
        │ Redis 8.2.2 :6379 (master)     │
        └───────────────────────────────┘
```

**关键实测结论（约束部署选型）：**

| 事实 | 来源 | 对部署的影响 |
| --- | --- | --- |
| NAS 无 docker CLI | `command -v docker` 无结果，fnOS 托管 | NAS 上只能走方案 B（裸机 systemd）或 fnOS 应用商店 |
| NAS MariaDB 10.3.28 原生安装 | `SELECT VERSION()` 实测 | 应用库可直连复用（本方案 §3 路径 B），但 10.3 已 EOL（见 §9 风险表） |
| `max_allowed_packet=100MB` | 实测变量值 | 成长相册 12MB 单图无压力，无需调参 |
| 本机 PG 15.15 与 NAS PG 流复制正常 | 巡检实测 | PG 体系承载其他业务，**本应用不依赖 PG**（mysql2 驱动） |
| 应用端到端链路验证通过 | 2026-10-21 e2e | `/healthz {"ok":true,"db":true}`、PUT/GET 回环、过期 revision 409 全部符合预期 |

---

## 三、数据库开通（二选一）

### 路径 A：方案 A 自带 MySQL 8.4（ECS compose 内置）

`docker-compose.yml` 已声明 `MYSQL_DATABASE: yyc3_baby_mochen` 与专用账号 `bgl`，首次 `docker compose up` 自动完成初始化，无需手工建库。只需在 `deploy/.env` 填 `MYSQL_PASSWORD` 与 `MYSQL_ROOT_PASSWORD`。

### 路径 B：复用 NAS MariaDB（内网方案，已实测通过）

在 NAS 上（SSH `yyc3-45`）执行；`$BGL_PWD` 用 `openssl rand -hex 16` 生成，写入 `deploy/.env.local`（`.gitignore` 的 `.env.*` 已覆盖，禁止入库）：

```sql
CREATE DATABASE IF NOT EXISTS yyc3_baby_mochen
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'bgl'@'%' IDENTIFIED BY '<随机密码>';
GRANT ALL PRIVILEGES ON yyc3_baby_mochen.* TO 'bgl'@'%';
FLUSH PRIVILEGES;
```

> 账号权限按库收敛（仅 `yyc3_baby_mochen.*`），密码随机生成、600 权限存放 —— 最小权限原则。
> 表结构无需手工迁移：服务启动时 `ensureSchema()` 自动建 `family_state` / `family_photo`。

---

## 四、方案 A：ECS docker compose（公网推荐）

适用：ECS yyc3-202 有 docker。链路：Caddy（自动 HTTPS）→ app :3000 → MySQL 8.4（仅内部网络）。

```bash
# 1. 构建产物（本地或 ECS 上执行）
npm run build && npm run build:server

# 2. 同步到 ECS（最小集 + deploy/）
rsync -av dist-server dist deploy/ root@47.94.135.202:/opt/baby-mochen/

# 3. ECS 上配置
cd /opt/baby-mochen/deploy
cp .env.example .env       # 填 MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD
vim Caddyfile              # baby.example.com → 真实域名（DNS A 记录 → 47.94.135.202）

# 4. 启动
docker compose up -d --build

# 5. 验收
curl -s https://baby.example.com/healthz
```

---

## 五、方案 B：裸机（NAS 内网 / ECS 无 docker 通用）

> **✅ 已于 2026-10-22 落地**：NAS 无 root（sudo 需密码），实际采用「便携版 Node + crontab 看门狗」
> 形态（[deploy/start.sh](./start.sh) 幂等拉起，`@reboot` + `*/5` 两条目），端口 3030。
> **日常运维、账号管理、备份恢复的权威手册见 [ops/OPERATIONS.md](../ops/OPERATIONS.md)。**
> 以下 systemd 流程保留给持有 root 的环境（如 ECS）。

NAS 实测无 docker，走本方案。前置：Node ≥ 20.11（`node -v` 检查；fnOS 若无则安装官方 Node 二进制包）。

```bash
# 1. 布局
sudo mkdir -p /opt/baby-mochen
sudo rsync -av dist-server dist deploy/ yyc3-45:/opt/baby-mochen/   # 经 Tailscale 直传 NAS

# 2. 配置（NAS 上）
cd /opt/baby-mochen
cp deploy/.env.example .env
# DATABASE_URL='mysql://bgl:<密码>@127.0.0.1:3306/yyc3_baby_mochen'   ← NAS 本机回环，不暴露网段
# PORT=3000

# 3. 服务
sudo cp deploy/baby-mochen.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now baby-mochen
systemctl status baby-mochen --no-pager

# 4. 验收（内网）
curl -s http://127.0.0.1:3000/healthz    # 期望 {"ok":true,"db":true}
```

内网对外暴露（可选）：用 fnOS 自带反向代理或 Tailscale Serve（`tailscale serve --bg --https=443 http://127.0.0.1:3000`）获得 HTTPS 入口；纯内网使用时可省略。

---

## 六、登录鉴权（三选一，不配则免登录回退模式）

| 方式 | 环境变量 | 说明 |
| --- | --- | --- |
| ① kimi OAuth | `APP_ID` `APP_SECRET` `KIMI_AUTH_URL` `KIMI_OPEN_URL` | 平台访客登录，OAuth code 换 token + JWKS 验签 |
| ② 反代注入头 | `AUTH_HEADER_USER` `AUTH_HEADER_NAME` `AUTH_HEADER_EMAIL` `AUTH_HEADER_FAMILY` | 网关完成认证后透传用户头 |
| ③ Bearer JWT | `AUTH_JWKS_URL` `AUTH_SIGNIN_URL`（可选 `AUTH_FAMILY_CLAIM`，默认 `family_id`） | 服务端拉 JWKS 验签（RS256/ES256/ES384/ES512），10 分钟缓存，fail-closed |

家庭隔离逻辑：未配置鉴权时全部请求落到回退家庭（单家庭自用模式）；配置后按会话的 family claim 隔离数据。

---

## 七、上线验收清单

```bash
BASE=http://127.0.0.1:3000   # 按实际入口替换
# 1. 健康检查（数据库连通）
curl -s $BASE/healthz                 # {"ok":true,"db":true}
# 2. 状态写入（乐观并发 revision 0 → 1）
curl -s -X PUT $BASE/api/state -H 'Content-Type: application/json' \
  -d '{"payload":{"smoke":true},"revision":0}'     # {"revision":1}
# 3. 状态回读
curl -s $BASE/api/state               # revision:1 + payload
# 4. 并发冲突拦截
curl -s -o /dev/null -w '%{http_code}\n' -X PUT $BASE/api/state \
  -H 'Content-Type: application/json' -d '{"payload":{},"revision":0}'   # 409
# 5. 静态首页
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' $BASE/            # 200 text/html
```

2026-10-21 已在 NAS MariaDB 链路上全量通过（见 §二）。

---

## 八、备份与容灾

```bash
# 每日 03:00 全库备份，本地保留 14 天，异地落地 NAS
crontab -e
0 3 * * * BACKUP_REMOTE=yyc3-45:/volume1/backups/baby-mochen \
  /opt/baby-mochen/deploy/backup.sh >> /var/log/bgl-backup.log 2>&1
```

- `backup.sh` 凭证直接解析同目录 `.env` 的 `DATABASE_URL`，明文不落第二处；`--single-transaction` 不锁表，兼容 MySQL 8.x 与 MariaDB 10.x。
- 恢复演练（建议每季度一次）：`gunzip -c <dump>.sql.gz | mysql -h <host> -u bgl -p yyc3_baby_mochen`。
- 照片二进制与状态同库（`family_photo` LONGBLOB），单库备份即全量，无额外对象存储依赖。

---

## 九、安全清单与已知风险

**安全（已落实 ✅）**

- [x] 密钥零入库：`.gitignore` 覆盖 `.env` / `.env.*`（`git check-ignore` 验证）；NAS root 密码仅出现在运维终端会话
- [x] 数据库专用最小权限账号（`bgl` 仅授权 `yyc3_baby_mochen.*`），密码 `openssl rand -hex 16`
- [x] 服务端响应头 `X-Content-Type-Options: nosniff`；Caddy 层再叠加 HSTS
- [x] systemd 单元基础加固（NoNewPrivileges / ProtectSystem=strict / PrivateTmp）
- [x] 写路径乐观并发 + 读写限流（内存令牌桶：写 60/min、读 300/min）

**风险与对策**

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| NAS MariaDB 10.3.28 已 EOL（2023-05 上游终止维护） | 🟡 | 短期可接受（仅内网 + 专用账号）；中期随 fnOS 升级迁移，或迁至方案 A 的 MySQL 8.4 |
| NAS 无 docker，无法用 compose 管理内网实例 | 🟢 | 已按裸机 systemd 设计方案 B；或等待 fnOS 应用商店提供容器能力 |
| 限流计数器为进程内存态，重启清零 | 🟢 | 单实例家庭场景影响可忽略；多实例扩容时引入 Redis（现网主从已就绪） |
| Bearer JWT 需 `AUTH_JWKS_URL` 可达 | 🟢 | JWKS 10 分钟缓存，签发方短暂抖动不影响存量会话；fail-closed 保证验签强度 |

---

## 十、回滚

- **应用**：`dist-server/boot.js` 为单文件原子替换。回滚 = 换回旧版文件 + `sudo systemctl restart baby-mochen`（或 `docker compose up -d --force-recreate app`），秒级。
- **数据库**：`ensureSchema()` 只增列不破坏；回滚旧版应用直接兼容新表结构。数据级回滚用 §八 最近一份 dump。
- **配置**：`.env` 变更后重启生效；误配置排查顺序：`systemctl status` → `journalctl -u baby-mochen -n 50` → `/healthz` 的 `db` 字段定位 DATABASE_URL 问题。

---

*维护：YanYuCloudCube · 上次实测：2026-10-21 · 实测人：AI 导师（Intelligent Application Implementation Expert）*
