---
file: 05-MariaDB-EOL评估分析.md
description: YYC3-Baby-MoChen 生产数据库 MariaDB 10.3 EOL 评估与迁移决定 - 智能应用落地导师 - 2026-10-22
author: AI Tutor <intelligent-app-impl>
version: v1.0.0
created: 2026-10-22
updated: 2026-10-22
status: active
tags: [database],[eol],[migration],[decision]
category: report
---

# 🗄️ U6 · 生产数据库 MariaDB EOL 评估分析

> 对应待办：[04-未执行项-统一优先级清单](./04-未执行项-统一优先级清单.md) 中的 **U6**
> 评估方式：NAS 实测（`ssh yyc3-45`）+ 官方生命周期事实核查，不以文档既有描述为准

## 结论摘要

| 项 | 结论 |
| --- | --- |
| **实测引擎** | MariaDB **10.3.28**（非 MySQL），fnOS 商店「MySQL」应用内置 |
| **EOL 状态** | 10.3 系列社区维护已于 **2023-05** 终止 → 已超期暴露 **约 41 个月**，且落后该系列末版 10.3.39 **11 个补丁级** |
| **迁移决定** | **方案 A：迁移至 MySQL 8.4 LTS**（支持至 **2032-04**），独立部署、旁路切换、可回滚 |
| **不采纳「随 fnOS 升级」** | 应用元数据自称 `version: 10.3.39`，而实际 `mysqld` 自报 `10.3.28` —— 目录版本与二进制不一致，依赖其升级不可信 |
| **风险等级** | 当前 **中高**（数据量小、可迁移性高；但引擎无安全补丁、全局字符集 latin1、sql_mode 含 MySQL 8 已移除项） |

## 一、现状实测

### 1.1 实例拓扑

| 属性 | 实测值 | 采集方式 |
| --- | --- | --- |
| 引擎与版本 | `10.3.28-MariaDB`（server 与 client 一致） | `mysqld --version`、`SELECT VERSION()` |
| 部署形态 | fnOS 应用「MySQL」，非系统包 | `dpkg -l` 无 mariadb-server；`systemctl` 仅 `mysql.service (generated)` |
| 可执行根 | `/Volume2/@apps/mysql/mysql` | `ps -eo args` |
| 数据目录 | `/Volume2/MySQL/database`（**152M**） | `mysqld` 启动参数、`du -sh` |
| 监听 | `*:3306`（全接口） | `ss -tln` |
| 进程归属 | `YYC3` 拉起 `mysqld_safe`，`mysqld` 以 `mysql` 身份运行 | `ps -eo user,pid,args` |
| 启动方式 | `/Volume2/@apps/mysql/init.d/MySQLs` → `sbin/mysql` 包装脚本 | 脚本读取 |
| 应用元数据 | `config.ini` 声明 `version: 10.3.39`；`install_data.json` 安装于 2026-03-02 | 文件读取 |
| 二进制时间戳 | 2026-05-26（安装/更新拷贝时间，非构建时间） | `ls -l` |
| root 访问 | 无免密入口（`Access denied`）→ **只能以业务账号操作** | socket 探测 |

> ⚠️ **关键不一致**：应用目录宣称 10.3.39（10.3 系列末版），实际运行二进制为 10.3.28。说明该应用包长期未随上游重建，fnOS 侧「版本号」不能作为安全基线。

### 1.2 库与体量（同一实例，共 4 个业务库）

| 库 | 体量 | 归属 | 说明 |
| --- | --- | --- | --- |
| `yyc3_baby_mochen` | 308K | **本项目生产库** | 3 张表，均 InnoDB / utf8mb4_unicode_ci |
| `yyc3_33` | 26M | 同族项目 | 共用实例，迁移时须一并评估 |
| `yyc3_music` | 4.0M | 同族项目 | 同上 |
| `yyc3_web` | 852K | 同族项目 | 同上 |
| `test` | 4.0K | 系统自带 | 空库 |

本项目 3 张表：`auth_user`、`family_photo`、`family_state`；当前 `family_photo` 行数为 **0**（照片未落生产库）。

### 1.3 应用侧依赖

| 依赖点 | 实测 | 迁移影响 |
| --- | --- | --- |
| 驱动 | `mysql2 ^3.24.3`，[server/db.js](../../server/db.js#L21) `mysql.createPool(process.env.DATABASE_URL)` | 同时支持 MySQL 8.4 与 MariaDB，无需改代码 |
| 连接串 | `mysql://bgl:***@127.0.0.1:3306/yyc3_baby_mochen` | 切换只需改端口/账号，`.env` 单点 |
| 备份二进制 | `MYSQLDUMP_BIN=/Volume2/@apps/mysql/mysql/bin/mysqldump`（10.3.28） | 迁移后须改指新实例客户端，否则出现版本倒挂 |
| 备份任务 | 每日 03:30 cron，保留 14 天，灌回演练已通过 | 迁移窗口内需临时停用 |

### 1.4 配置特征与兼容性隐患

| 观察 | 实测值 | 隐患 |
| --- | --- | --- |
| `sql_mode` | `STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,**NO_AUTO_CREATE_USER**,NO_ENGINE_SUBSTITUTION` | **MySQL 8.0 起已移除 `NO_AUTO_CREATE_USER`**，直接导入会报 1231；dump 文件头同样携带该值 |
| `character_set_server` | **latin1** | 表为 utf8mb4，但服务端默认 latin1，新建库/临时表存在乱码风险 |
| 认证插件 | 业务账号使用 `mysql_native_password` 时代语义 | **MySQL 8.4 默认禁用 `mysql_native_password`**，须用 `caching_sha2_password`（mysql2 支持） |
| 存储引擎 | 全部 InnoDB | 无 Aria/MyISAM 依赖，跨引擎迁移阻力低 |
| 数据量 | 全实例 152M | 停机窗口可控制在分钟级 |

## 二、EOL 事实核查

| 版本线 | GA | 维护终止 | 距今余量（2026-10） | 判定 |
| --- | --- | --- | --- | --- |
| **MariaDB 10.3（现网）** | 2018-05 | **2023-05** | **已超期 41 个月** | 🔴 必须迁出 |
| MariaDB 10.11 LTS | 2023-02 | 2028-02 | 约 16 个月 | 🟡 短期可用 |
| MariaDB 11.4 LTS | 2024-05 | 2029-05 | 约 31 个月 | 🟡 需二次迁移 |
| MariaDB 12.3 | 2026-05 | 2029-06 | 约 32 个月 | 🟡 过新，生态验证不足 |
| **MySQL 8.0** | 2018-04 | **2026-04** | **已 EOL** | 🔴 不可作为目标 |
| **MySQL 8.4 LTS** | 2024-04 | **2032-04**（5 年 Premier + 3 年 Extended） | **约 66 个月** | 🟢 首选 |

补充事实：MariaDB 10.3 系列末版为 10.3.39（2023-05 发布），此后不再有安全修复；现网 10.3.28 连该末版的补丁也未跟上。

## 三、风险评级（五维）

| 维度 | 风险 | 等级 | 依据 |
| --- | --- | --- | --- |
| 时间 | 无安全补丁窗口已 41 个月 | 高 | 10.3 社区维护 2023-05 终止 |
| 空间 | 单实例 4 库共用，牵一发动全身 | 中 | 26M 的 `yyc3_33` 同族项目亦在其上 |
| 属性 | 字符集 latin1 + 过期 sql_mode | 中高 | 迁移与新建对象均可能踩坑 |
| 事件 | 引擎由 fnOS 应用层托管，升级不可控 | 高 | 目录版本 10.3.39 ≠ 二进制 10.3.28 |
| 关联 | 备份链路 `MYSQLDUMP_BIN` 硬编码旧路径 | 中 | 换引擎后不对齐会导致备份失效而无感 |

## 四、方案比选

| 方案 | 内容 | 生命周期 | 迁移成本 | 主要风险 | 结论 |
| --- | --- | --- | --- | --- | --- |
| **A ✅** | 独立部署 **MySQL 8.4 LTS**，旁路建实例后切换 | 至 **2032-04** | 中（需清洗 sql_mode、换认证插件） | 与 MariaDB 方言差异（本项目仅基础 SQL，影响小） | **采纳** |
| B | MariaDB 11.4 LTS 独立部署 | 至 2029-05 | 低（同源最平滑） | 3 年内需再迁一次；仍受 fnOS 应用生态影响 | 备选/回退路径 |
| C | 维持 10.3 现状 | 已于 2023-05 终止 | 0 | 无安全补丁，长期裸奔 | 否决 |
| D | 随 fnOS 应用升级 | 不可预期 | 低 | 应用元数据与实际二进制已不一致，无法作为基线承诺 | 否决 |

**选 A 的理由**：① 唯一能把「下一次数据库迁移」推后到 2032 的选项；② 本项目数据量与 SQL 复杂度极低（3 表、全 InnoDB、基础 DML），跨家族迁移的典型风险面在此几乎不存在；③ `mysql2` 原生支持 MySQL 8.4，代码零改动；④ 独立部署可摆脱 fnOS 应用目录的版本失控（与 GitBucket 三波接管的教训一致）。

## 五、实施路线（可回滚，分阶段）

### Phase 0 · 本周加固（不换引擎，立即降低暴露面）

- [ ] 确认每日 03:30 备份可用（已 ✅），另做一次**迁移前基准 dump** 并归档
- [ ] 复核 3306 是否需收敛为 `127.0.0.1` 监听（当前 `*:3306`）
- [ ] 记录基线：各库表数、行数、校验和，作为迁移验收比对依据

### Phase 1 · 旁路建实例（不动生产）

```bash
# 在 NAS 起 MySQL 8.4 LTS（端口 3307，独立数据目录，避免影响 3306）
docker run -d --name mysql84 --restart unless-stopped -p 127.0.0.1:3307:3306 \
  -e MYSQL_ROOT_PASSWORD='${MYSQL84_ROOT_PASSWORD}' \
  -v /Volume3/DockerAppData/MySQL84/data:/var/lib/mysql \
  -v /Volume3/DockerAppData/MySQL84/conf:/etc/mysql/conf.d \
  mysql:8.4
```

- [ ] 配置 `character-set-server=utf8mb4`、`collation-server=utf8mb4_unicode_ci`
- [ ] 建库 `yyc3_baby_mochen` + 业务账号（`caching_sha2_password`）
- [ ] 导入时**必须清洗 dump 中的 `NO_AUTO_CREATE_USER`**（否则 MySQL 8 报 1231）

```bash
# 从 10.3 导出 → 清洗 → 导入 8.4
mysqldump --single-transaction --routines --triggers --databases yyc3_baby_mochen \
  | sed 's/,NO_AUTO_CREATE_USER//g' | mysql -h127.0.0.1 -P3307 -u bgl -p
```

- [ ] 数据比对：表数、行数、关键表校验和一致
- [ ] 应用侧指向 3307 跑 e2e（登录 / 读写 / 照片），通过后进入下一阶段

### Phase 2 · 切换（分钟级停机）

1. 停应用看门狗（`crontab` 注释 `*/5` 与 `@reboot` 两条，避免自动拉起旧配置）
2. 最终增量 dump → 清洗 → 导入 3307 → 比对
3. 改 NAS `.env`：`DATABASE_URL` 端口 3306→3307、`MYSQLDUMP_BIN` 指向 8.4 客户端
4. 起应用 → `curl http://192.168.3.45:3030/healthz` 期望 `{"ok":true,"db":true}`
5. 恢复看门狗

### Phase 3 · 收尾

- [ ] 旧 3306 实例保留**只读观察 7 天**，确认无遗漏写入后停用
- [ ] 备份脚本、[ops/OPERATIONS.md](../../ops/OPERATIONS.md) 同步更新
- [ ] 同族库（`yyc3_33` / `yyc3_music` / `yyc3_web`）按同法迁移或明确保留决策
- [ ] 本清单 U6 标记 ✅ 并记录决策

### 回滚方案

改回 `.env` 端口 3306 + 重启应用即可（旧实例在 Phase 3 之前始终保持原样、不停机、不改配置），回滚窗口 ≤ 5 分钟。

## 六、验收标准

| 项 | 标准 |
| --- | --- |
| 引擎版本 | `SELECT VERSION()` 返回 8.4.x |
| 服务支持 | 目标线支持期 ≥ 2032 |
| 数据完整性 | 表数 / 行数 / 关键表校验和与基线一致 |
| 应用可用 | `healthz` 返回 `{"ok":true,"db":true}`，登录-写入-e2e 全通过 |
| 备份可用 | 新 `MYSQLDUMP_BIN` 产出 dump，灌回新实例演练通过 |
| 暴露面 | 新实例仅监听 `127.0.0.1:3307` |

## 七、参考来源

- [MariaDB 10.3 已停止维护（官方文档）](https://mariadb.com/docs/release-notes/mariadb-community-server-release-notes/old-releases/release-notes-mariadb-10-3-series/what-is-mariadb-103)
- [MariaDB 10.3 Changelogs（维护至 2023-05）](https://mariadb.com/kb/en/changelogs-mariadb-10-3-series/)
- [MariaDB Engineering Policy（各系列 EOL 表）](https://mariadb.com/wp-content/uploads/2025/08/mariadb-engineering-policies-v4-29_policy_1199.pdf)
- [MariaDB 10.6 EOL 公告（含 10.11 / 11.4 / 11.8 EOL 日期）](https://mariadb.org/mariadb-server-10-6-reaches-end-of-life-on-july-6th/)
- [MariaDB 11.4 维护至 2029-05](https://mariadb.com/docs/release-notes/community-server/mariadb-11-4-series/what-is-mariadb-114)
- [MySQL 产品 EOL 公告（8.0 于 2026-04 进入 Sustaining Support）](https://www.mysql.com/support/eol-notice.html)
- [MySQL 8.0 Release Notes（8.0.46 为终版）](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)
- [MySQL LTS 生命周期（8.4：5 年 Premier + 3 年 Extended → 约 2032-04）](http://docs.oracle.com/cd/E17952_01/mysql-8.4-en/mysql-releases.html)

## 八、变更记录

| 日期 | 变更 | 原因 |
| --- | --- | --- |
| 2026-10-22 | 建档：完成实测（引擎/拓扑/库体量/依赖/配置隐患）、EOL 核查、四方案比选，输出迁移决定 A + 分阶段路线 | 用户指令「请生成 U6 MariaDB EOL 评估报告」 |
