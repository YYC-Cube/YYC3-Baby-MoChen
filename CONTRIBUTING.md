<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <b>YanYuCloudCube™</b> · 言启象限 | 语枢未来<br />
  <i>Words Initiate Quadrants, Language Serves as Core</i>
</p>

# 贡献指南

感谢你愿意为 **YanYuCloudCube-MoChen** 贡献时间与智慧。本指南说明如何搭建环境、修改代码、验证改动并提交贡献。

> 参与本项目即表示你同意遵守 [行为准则](./CODE_OF_CONDUCT.md)。安全漏洞请按 [安全政策](./SECURITY.md) 私下报告，不要公开提交 Issue。

## 目录

- [开始之前](#开始之前)
- [开发环境](#开发环境)
- [分支与提交](#分支与提交)
- [代码约定](#代码约定)
- [扩展记录类型与图表](#扩展记录类型与图表)
- [国际化约定](#国际化约定)
- [服务端约定](#服务端约定)
- [验证清单](#验证清单)
- [提交 Pull Request](#提交-pull-request)
- [文档要求](#文档要求)
- [联系方式](#联系方式)

---

## 开始之前

请先阅读：

1. [README.md](./README.md) — 架构、脚本、环境变量与接口
2. [`info.md`](./info.md) — 模板原始说明与历史设计决策
3. [`docs/全局风格令牌与图资替换指导.md`](./docs/全局风格令牌与图资替换指导.md) — 设计令牌与图资规范
4. [`docs/YYC3-团队通用-标准规范/`](./docs/YYC3-团队通用-标准规范/) — 团队开发标准与文档闭环

**适用场景**：缺陷修复、功能增强、文档完善、性能优化、安全加固。超出项目定位的重构（如引入状态管理库、UI 框架、CSS-in-JS）请先开 Issue 讨论，避免无效工作。

---

## 开发环境

### 环境要求

- Node.js ≥ 20（推荐 20 / 22 LTS）
- npm（仓库使用 `package-lock.json`）
- 可选：MySQL 8+ 或 TiDB（仅全栈联调需要）

### 安装与启动

```bash
# 安装依赖
npm install

# 启动开发服务器（团队约定端口 3030 起）
npm run dev -- --host 0.0.0.0 --port 3030
```

### 全栈联调（可选）

```bash
# 1. 准备 MySQL / TiDB 数据库
# 2. 配置环境变量（不要提交 .env）
export DATABASE_URL="mysql://user:pass@host:3306/db"
export PORT=3030

# 3. 生产构建并启动
npm run build
npm start
```

未配置 `DATABASE_URL` 时，应用会自动退回本地存储；未配置登录时，应用会明确提示「登录服务不可用」，这是预期降级。

---

## 分支与提交

### 分支命名

```text
main                 # 可发布分支，禁止直接推送
feat/<scope>         # 新功能，例：feat/chart-marker
fix/<scope>          # 缺陷修复，例：fix/sync-conflict
docs/<scope>         # 文档，例：docs/readme-architecture
chore/<scope>        # 工程杂项，例：chore/build-target
refactor/<scope>     # 重构，例：refactor/i18n-labels
```

### 提交信息

采用 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
<type>(<scope>): <summary>

[optional body]

[optional footer]
```

允许的 `type`：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`。

示例：

```text
feat(today): 指标卡支持长按排序
fix(server): 冲突写入返回服务端当前 revision
docs(contributing): 补充扩展记录类型步骤
```

要求：

- 一条提交只做一件事，避免把重构与功能混在一起；
- 提交信息说明「为什么」，而不是复述「改了什么」；
- 不提交 `.env`、密钥、数据库导出、构建产物与 `node_modules`。

---

## 代码约定

### 通用

- 注释使用中文，解释设计取舍与坑点，不复述代码字面；
- 标识符使用英文，遵循现有命名风格（`camelCase` / `PascalCase`）；
- 不引入未使用的依赖、工具函数或抽象层；
- 修改现有文件优先于新建文件；
- 保持模块单一职责，避免跨层直接访问。

### 前端

- 仅使用 React 原生状态与 Hooks，不引入状态管理库；
- 样式写入 `src/styles.css` 或 `src/kit.css`，沿用现有 CSS 变量与圆角阶梯；
- 不引入第三方字体 CDN，字体仅使用自托管的 Nunito Variable 与 Noto Sans SC Variable；
- 所有可点击元素必须有按压反馈与可访问名称；
- 界面文案禁止硬编码，统一走 [`src/i18n.js`](./src/i18n.js)。

### 服务端

- 新增接口必须考虑：鉴权、限流、请求体上限、错误码语义；
- 提前返回（401 / 403 / 413 / 429 / 503）的分支必须调用 `drain(req)` 排空请求体；
- 错误响应不泄露内部细节与堆栈；
- 数据库读写必须参数化，禁止拼接 SQL；
- 修改 `server/db.js` 的 schema 时，必须保持 `CREATE TABLE IF NOT EXISTS` 的幂等性。

### 禁止事项

- ❌ 硬编码密钥、Token、连接串；
- ❌ 在静态产物中保留服务端探测逻辑（必须受 `__SHARED_BACKEND__` 编译期常量保护）；
- ❌ 把记录选项的存储值改成英文；
- ❌ 在 `localStorage` 中存储照片位图或 base64；
- ❌ 绕过会话直接使用前端传入的 `family` 参数读取数据。

---

## 扩展记录类型与图表

### 新增记录类型

1. 在 [`src/data.js`](./src/data.js) 的 `recordTypes` 中新增声明，包含 `id`、分组、字段、选项与英文文案字段；
2. 在 [`src/charts.js`](./src/charts.js) 的 `chartSpecs` 中分配图表形态（`session` / `bar` / `stack` / `line` / `marker`）；不可量化的类型不加入图表；
3. 在 [`src/i18n.js`](./src/i18n.js) 补齐名称、字段、选项、单位与无障碍文案；
4. 在 [`src/metrics.js`](./src/metrics.js) 中按需新增指标卡；
5. 检查 `typeOrder` 的兼容性：新类型通过 `mergeOrder` 合并，旧存档不会丢失已保存顺序；
6. 用真实数据验证：新增 → 刷新 → 图表与今日时间线 → 删除。

### 新增图表形态

1. 在 [`src/charts.js`](./src/charts.js) 新增聚合函数，返回统一的 `dayRows` 以便下钻；
2. 在 [`src/chartkit.jsx`](./src/chartkit.jsx) 新增绘制组件；
3. 在图表视图中接入点击下钻与空数据态；
4. 验证天 / 周 / 月三种粒度与前后翻页边界（不可翻到未来）。

---

## 国际化约定

- 带数据语义的名称使用「原值 + `xxxEn`」并存，渲染时通过 `trType` / `trLabel` / `trValue` 解析；
- 存储值永远是中文原值，翻译只发生在渲染层；
- 时间与时长格式化函数必须传入 `lang`，漏传会静默退回中文；
- 表单 `placeholder`、图表标题、折线系列名分别使用 `placeholderEn`、`titleEn`、`labelEn`；
- toast、`aria-label`、`title`、`alt` 全部走 `i18n.js` 的 `a11y` 段。

自检方式：切换到英文界面，遍历图表 / 今日 / 相册 / 家庭 / 设置 / 表单，确认除成员名与宝宝名外无中文字面量。

---

## 服务端约定

- 会话解析顺序：kimi 会话 → 反向代理 Header → Bearer JWT；解析失败一律视为未登录；
- 家庭 id 由会话推导，前端传入值仅在未接入 auth 时生效；
- 写状态必须携带 `revision`，冲突返回 `409` 与服务端当前状态；
- 照片上传限制 12 MiB，状态写入限制 8 MiB；
- 限流按会话 `userId` 优先计数，避免共用出口的家庭成员互相误伤；
- 新增环境变量必须同步更新 README 的配置表，并提供安全默认值。

---

## 验证清单

提交前请完成：

- [ ] `npm install` 无错误；
- [ ] `npm run build` 成功；
- [ ] `npm run dev -- --port 3030` 页面可打开，控制台无报错；
- [ ] 修改涉及全栈能力时，验证 `/healthz`、读写状态、照片上传与冲突回落；
- [ ] 修改涉及界面时，验证 1440px 与 390px 两种视口；
- [ ] 修改涉及文案时，切换中英文各走一遍主流程；
- [ ] 修改涉及数据模型时，验证旧存档可正常加载（迁移兜底）；
- [ ] 无硬编码密钥、无敏感信息进入日志；
- [ ] 文档与代码保持一致（接口、脚本、环境变量、目录结构）。

> 仓库当前未内置自动化测试框架。若你新增测试，请使用 Node 内置 `node:test` 或 Vitest，并在 PR 中说明运行命令。

---

## 提交 Pull Request

1. 从 `main` 拉出功能分支；
2. 完成修改并自测；
3. 提交前运行 `git diff` 复查，确保没有无关改动；
4. 发起 PR，填写：
   - **变更目的**：解决什么问题；
   - **变更范围**：涉及模块与文件；
   - **验证方式**：执行过的命令与手工验证步骤；
   - **风险与回滚**：潜在影响与回滚方式；
   - **截图**：界面改动附前后对比（桌面 + 移动）。
5. 等待维护者审查；根据反馈修改时，新增提交而不是强推覆盖历史。

### 审查关注点

| 维度 | 关注内容 |
| --- | --- |
| 正确性 | 边界条件、空数据、旧数据、并发冲突 |
| 安全性 | 越权读取、注入、敏感信息、限流绕过 |
| 性能 | 不必要的重渲染、重复请求、位图进入 `localStorage` |
| 可维护性 | 模块职责、命名、是否引入多余抽象 |
| 一致性 | 设计令牌、文案、双语、错误码、文档 |

---

## 文档要求

- 新增或修改脚本、环境变量、接口、数据表时，同步更新 [README.md](./README.md)；
- 新增目录或模块时，同步更新 README 的目录结构；
- 重要设计取舍写入代码注释或 `docs/`，避免只存在于对话记录中；
- 文档中的代码链接必须可点击并指向正确文件；
- 不提交包含真实密钥、账号、家庭数据的截图或日志。

---

## 联系方式

| 渠道 | 信息 |
| --- | --- |
| 邮箱 | [china@yanyucloud.com](mailto:china@yanyucloud.com) |
| 安全问题 | 见 [SECURITY.md](./SECURITY.md)，请勿公开提交 |
| 行为准则 | 见 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) |

---

<p align="center">
  <sub>© 2025-2026 YanYuCloudCube · <a href="mailto:china@yanyucloud.com">china@yanyucloud.com</a></sub>
</p>
