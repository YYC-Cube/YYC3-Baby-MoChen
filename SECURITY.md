<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <b>YanYuCloudCube™</b> · 言启象限 | 语枢未来<br />
  <i>Words Initiate Quadrants, Language Serves as Core</i>
</p>

# 安全政策

## 支持的版本

| 版本 | 支持状态 | 说明 |
| --- | --- | --- |
| `1.x` | ✅ 安全更新 | 当前主线版本 |
| `< 1.0` | ❌ 不支持 | 请升级到最新版本 |

## 报告安全漏洞

**请不要通过公开 Issue、Pull Request、 Discussions 或社交媒体披露安全漏洞。**

请发送邮件至：

- **邮箱**：[china@yanyucloud.com](mailto:china@yanyucloud.com)
- **主题格式**：`[SECURITY] YanYuCloudCube-MoChen · 漏洞简述`
- **建议加密**：如条件允许，请使用 PGP 加密后发送；未加密时请避免在邮件中附带真实家庭数据。

### 报告内容

请尽量提供：

1. **漏洞类型**：越权、注入、XSS、CSRF、信息泄露、拒绝服务等；
2. **影响范围**：受影响的接口、页面、配置或版本；
3. **复现步骤**：足够让维护者独立复现的最小步骤；
4. **影响评估**：可读取/修改的数据范围，是否需要登录；
5. **修复建议**：如有；
6. **联系方式**：便于后续沟通。

> 请勿在报告中附带真实用户的记录、照片、Cookie 或数据库导出。使用自建测试数据复现。

### 响应流程

| 阶段 | 目标时限 |
| --- | --- |
| 确认收到 | 3 个工作日内 |
| 初步评估与分级 | 7 个工作日内 |
| 修复或缓解方案 | 视严重程度与影响面确定，并在沟通中同步 |
| 公开披露 | 修复发布后，经双方协商一致 |

我们遵循**协调披露**原则：在修复发布前，请勿公开漏洞细节。若你希望署名，请在报告中注明。

## 安全范围

### 纳入范围

- 身份认证与会话绕过；
- 跨家庭数据读取、写入或照片越权访问；
- SQL 注入、路径穿越、命令注入；
- 存储型 / 反射型 XSS；
- CSRF 导致的敏感状态变更；
- 敏感信息泄露（密钥、连接串、会话、家庭数据）；
- 限流绕过导致的资源耗尽；
- 依赖供应链高危漏洞。

### 不纳入范围

- 需要物理接触设备或已完全控制用户浏览器的攻击；
- 用户自己粘贴到控制台的代码（Self-XSS）；
- 社会工程学与钓鱼；
- 已知限制中明确声明为非目标的场景；
- 仅影响界面美观、无安全影响的缺陷；
- 第三方平台（Kimi OAuth、TiDB、CDN）自身的问题，请直接向其报告。

## 安全设计

本项目已在代码层面实现以下防护：

| 防护 | 实现位置 | 说明 |
| --- | --- | --- |
| 会话 Cookie | [`server/kimi.js`](./server/kimi.js) | `HttpOnly`；本地 `SameSite=Lax`，线上 `SameSite=None; Secure`；有效期 30 天 |
| OAuth state 校验 | [`server/kimi.js`](./server/kimi.js) | state 带 HMAC 签名，防止回调伪造与篡改 |
| Access Token 验签 | [`server/kimi.js`](./server/kimi.js) | 拉取 JWKS，使用 Node `crypto` 验 RS256 / ES256 等签名，校验 `exp` |
| 会话 JWT | [`server/kimi.js`](./server/kimi.js) | HMAC-SHA256 签发，使用 `timingSafeEqual` 比较 |
| Bearer JWT 验签 | [`server/auth.js`](./server/auth.js)、[`server/kimi.js`](./server/kimi.js) | `AUTH_JWKS_URL` 拉取 JWKS，验 RS256 / ES256 / ES384 / ES512 签名与 `exp`，公钥缓存 10 分钟，验不过一律拒绝 |
| 照片 MIME 白名单 | [`server/index.js`](./server/index.js)、[`server/db.js`](./server/db.js) | 上传仅接受 jpeg / png / webp / gif（白名单外 `415`），读取兜底 `application/octet-stream`，全响应 `nosniff` |
| 家庭隔离 | [`server/index.js`](./server/index.js)、[`server/auth.js`](./server/auth.js) | 家庭 id 以服务端会话为准，忽略前端 `?family=` |
| 未登录拒绝 | [`server/index.js`](./server/index.js) | 接入 auth 后数据接口一律 `401`，未登录不得读写真实数据 |
| 写入限流 | [`server/index.js`](./server/index.js) | 写 60 次/分钟、读 300 次/分钟，优先按会话用户计数 |
| 请求体上限 | [`server/index.js`](./server/index.js) | 状态 8 MiB、照片 12 MiB，超限 `413` |
| 请求体排空 | [`server/index.js`](./server/index.js) | 提前拒绝时调用 `drain(req)`，避免客户端连接挂起 |
| 路径穿越防护 | [`server/index.js`](./server/index.js) | `resolve` 后校验目标仍位于站点根目录内 |
| SQL 参数化 | [`server/db.js`](./server/db.js) | 全部使用占位符查询，禁止拼接 |
| 乐观并发 | [`server/db.js`](./server/db.js) | `revision` 条件更新，冲突返回 `409`，避免相互覆盖 |
| 数据最小化 | [`src/auth.js`](./src/auth.js)、[`src/store.js`](./src/store.js) | 前端账号对象只保留必要字段，凭证不进入同步 payload |
| 凭据管理 | 运行时环境变量 | 凭据不写入仓库、不打包进 zip、不出现在前端 |

## 已知限制

以下为当前版本的已知限制，部署前请评估：

1. **限流为单实例内存桶**
   计数存于进程内存，重启清零，多实例部署时各实例独立计数。它用于阻挡脚本刷库，不适用于精确配额或分布式限流。

2. **`X-Forwarded-For` 可被伪造**
   限流键优先使用会话 `userId`；仅在未登录时使用转发头首段。若未部署可信反向代理，请勿依赖 IP 限流做安全边界。

3. **未实现显式 CSRF Token**
   状态变更使用 JSON `PUT`，浏览器会触发预检；服务端未开启 CORS，跨源预检不会通过。若未来开放跨域访问，必须补充 CSRF Token 或严格的 Origin 校验。

4. **无病毒扫描与内容审核**
   照片上传已有 MIME 白名单与 `nosniff` 兜底，但内容本身不重编码、不杀毒；本项目面向可信家庭内部使用，不适用于公开上传场景。

5. **登录闭环依赖外部认证服务**
   OAuth 授权与 JWKS 的可用性由外部平台决定；本应用在认证失败时一律按未登录处理，不会放行。

## 安全部署清单

上线前请逐项确认：

- [ ] `DATABASE_URL` 使用最小权限账号，仅授予目标库的读写权限；
- [ ] 数据库连接启用 TLS，凭据仅通过平台密钥管理注入；
- [ ] `APP_ID` / `APP_SECRET` 不进入镜像、zip、日志或前端产物；
- [ ] 生产环境使用 HTTPS，会话 Cookie 保持 `Secure`；
- [ ] 反向代理层配置 HSTS、`X-Content-Type-Options: nosniff`、合理的请求体上限；
- [ ] 反向代理只信任自身注入的身份头，剥离客户端伪造的同名头；
- [ ] 确认 `/healthz` 不泄露敏感配置（当前仅返回 `ok` 与 `db` 布尔值）；
- [ ] 定期执行 `npm audit`，高危依赖及时升级；
- [ ] `AUTH_JWKS_URL` 与其他组件共享同一签发方时，约定并校验 `aud` / `iss` 声明，避免 Token 被跨组件复用；
- [ ] 备份数据库，并验证恢复流程；
- [ ] 日志中不记录 Cookie、Token、完整连接串与家庭数据；
- [ ] 如需对外开放注册或多租户使用，先完成「已知限制」中的 3、4 项加固。

## 依赖安全

```bash
# 检查已知漏洞
npm audit

# 仅检查生产依赖
npm audit --omit=dev
```

发现高危漏洞时，请同时通过安全邮箱告知维护者，以便评估影响范围。

## 安全更新记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-10-21 | `Unreleased` | Bearer JWT 验签落地；照片 MIME 白名单 + `nosniff`；静态打包修复同步入档 |
| 2026-10-21 | `1.0.0` | 建立安全政策与部署清单 |

---

<p align="center">
  <sub>© 2025-2026 YanYuCloudCube · <a href="mailto:china@yanyucloud.com">china@yanyucloud.com</a></sub>
</p>
