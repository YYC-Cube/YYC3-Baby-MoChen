# 通用智能编程 AI 验收：闭环提示词体系（分类设计）

> **技术栈基线**：Next.js 16+ App Router / React 19+ / Vite / shadcn/ui / Radix UI / Tailwind CSS / pnpm / TypeScript
> **体系代号**：S-G-A-R-A 双环模型（Specify → Generate → Accept → Rectify → Archive）
> **适用对象**：使用 AI 编程工具（Claude Code、Cursor、Copilot、Kimi 等）产出的全部代码、文档与工程交付物
> **版本**：v1.0 ｜ 2026-10

---

## 摘要

本报告交付一套**可直接投产**的「通用智能编程 AI 验收闭环提示词体系」。它以 2025–2026 年生成式 AI 编程的三项硬事实为出发点：其一，METR 的随机对照试验证实开发者对 AI 提效的感知与实测之间存在 **39 个百分点**的鸿沟——预期提速 24%、事后自认提速 20%，实测却放慢 19%（[METR 2025，转引自 Uvik](https://uvik.net/blog/ai-code-generation-statistics/)）；其二，Veracode 2025 年报告显示 **45% 的 AI 生成代码样本含有 OWASP Top 10 漏洞**，AI 代码漏洞密度约为人工代码的 **2.74 倍**（[Mindgard](https://mindgard.ai/blog/ai-code-security)）；其三，AI 代码具有「表面可信（false fluency）」特征——能编译、似优雅、藏隐患，倒逼工程组织把「验收」从人工抽查升级为**结构化、可度量、可回归的提示词驱动流程**。

体系设计融合三条主线：**提示词工程的要素规范**（角色、指令、上下文、输入、格式、示例六要素，及 RTF / CO-STAR / RISEN / EARS 等框架对比选型）、**QA 验收的工程标准**（Google AAA 测试模式、P0–P4 缺陷分级、质量门禁、OWASP 安全测试）、以及 **LLM-as-a-Judge 的评估科学**（rubric 设计、JSON Schema 结构化裁决、位置/冗长/自偏好偏差缓解、金标准集校准）。最终产出为「**一个元规范 + 一个双环模型 + 十三套分类提示词模板 + 一套质量门禁与运营机制**」，全部提示词模板可直接复制到任意 AI 编程会话中使用，并给出在 YYC³ Cube 双组织 99 仓库矩阵生态中的分层落地示例。

---

## 1. 设计动因：AI 编程为什么必须有「验收闭环」

### 1.1 生产力的感知鸿沟：验收缺失的隐性成本

AI 编程工具的生产力证据在 2025–2026 年呈现出剧烈的结论分裂，而分裂本身正是「无验收则不提效」的最佳注脚。在受控的孤立任务中，GitHub 的实验测得开发者完成 HTTP 服务器任务的速度提升 **55.8%**（95% CI [21%, 89%]）（[Peng et al. 2023，转引自 Uvik](https://uvik.net/blog/ai-code-generation-statistics/)）；覆盖微软、埃森哲及一家财富 100 强企业的三项随机对照试验、合计 4867 名开发者的同行评审研究则测得完成任务数提升 **26.08%**（SE 10.3%）（[Management Science 2026，转引自 LowCode Agency](https://www.lowcode.agency/blog/app-development-cost-statistics)）。然而在 METR 针对 16 名资深开源维护者、246 个真实任务的 RCT 中，允许使用 AI 的一组反而**慢 19%**，且受试者事前预期提速 24%、事后仍坚信提速 20%，感知与实测方向相反（[METR 2025，转引自 Leyton CognitX](https://cognitx.leyton.com/metr-2025-rct-ai-tools-slowed-experienced-open-source-devs-by-19-analysis/)）。

![AI 编程工具生产力：预期、感知与实测的鸿沟](/Users/yanyu/YANYUCLOUDCUBE/YYC3-团队通用-标准规范/YYC3-智能编程-验收提示/productivity-gap.svg)

鸿沟的成因不是「AI 不行」，而是**瓶颈从「写代码」转移到了「验代码」**。Faros 的遥测数据显示，AI 辅助团队的 PR 数量增加 98%，但代码评审时间增加 91%，生产力增益被评审队列吞噬（[SoftwareSeni](https://www.softwareseni.com/what-the-research-actually-shows-about-ai-coding-assistant-productivity/)）；同一来源还指出，仅 **39%** 的 Cursor 生成结果被直接采纳。METR 在 2026 年 2 月的随访修订中进一步说明，由于 30–50% 的开发者拒绝在无 AI 条件下参与实验，原结论幅度被高估，修订估计为 -4%（CI -15% ~ +9%）——但「感知显著高于实测」这一核心发现在修订后依然成立（[Museum of Vibe Coding](https://museumofvibecoding.org/vibe-coding-productivity-paradox-why-speed-does-not-equal-value-unbiased-research-2026/)）。对工程管理的含义是清晰的：**凡不能用客观指标验收的 AI 产出，其「提效」都只是体感**；验收闭环是把体感转化为可审计资产的前提。

### 1.2 AI 代码的「表面可信」与安全实证

如果说效率维度的风险是「白忙」，安全维度的风险则是「埋雷」。Veracode 2025 年 GenAI 代码安全报告对 100 余个 LLM 的测试发现：**45% 的 AI 生成代码样本引入 OWASP Top 10 漏洞**，AI 代码漏洞密度为人工代码的 **2.74 倍**；在针对性场景中，AI 生成代码的 XSS 防护失败率达 **86%**、日志注入防护失败率达 **88%**、不安全加密实现占比 **14%**（[GrowExx](https://www.growexx.com/blog/ai-generated-code-owasp-top-10/)）。学术研究将这种现象命名为「表面可信（false fluency）」：代码语法正确、风格优雅，却内含硬编码口令、不安全随机数、过时加密函数等隐患，开发者容易被「看起来专业」的输出麻痹（[TUNI 学位论文库](https://trepo.tuni.fi/bitstream/10024/232551/2/WijayaAlvinSteven.pdf)）。

![AI 生成代码的安全风险画像](/Users/yanyu/YANYUCLOUDCUBE/YYC3-团队通用-标准规范/YYC3-智能编程-验收提示/ai-code-security-risk.svg)

供给链维度同样不容乐观：AI 幻觉出的不存在包名会被攻击者抢注投毒（slopsquatting），静态扫描器对此无能为力；Apiiro 的研究测得财富 50 强企业中 AI 生成代码的密钥暴露量增加 40%（[Mindgard](https://mindgard.ai/blog/ai-code-security)）。OWASP 为此在 Web Top 10 之外相继发布 LLM Top 10（2025）与 Agentic Applications Top 10（2026），后者新增 Agent Goal Hijack、Privilege Escalation、Memory & Context Poisoning 等智能体特有风险（[DSAlta](https://www.dsalta.com/resources/ai-compliance/owasp-top-10-agentic-ai-compliance-posture)）。这意味着 AI 代码验收必须同时覆盖**传统 Web 安全**与**AI 特有安全**两个清单，且以「零信任」姿态对待每一段生成代码——这正是本体系 P-07 安全验收模板采用双清单设计的依据。

### 1.3 范式迁移：从提示词工程到上下文工程与规格驱动开发

2025 年是行业话语从「提示词工程」转向「上下文工程」的拐点。Karpathy 将上下文工程定义为「为下一步向上下文窗口填入恰切信息的精巧艺术与科学」；Neo4j 的技术博客则系统论证了二者的分工——提示词工程关注一次性指令的措辞，上下文工程关注智能体持续交互中的信息架构（系统提示、工具、记忆、历史、结构化输出）（[Neo4j](https://neo4j.com/blog/agentic-ai/context-engineering-vs-prompt-engineering/)）。Gartner 亦指出上下文工程正迅速取代提示词工程成为企业 AI 的关键技能（[TowardsAgenticAI](https://towardsagenticai.com/context-engineering-vs-prompt-engineering-the-2025-ai-shift/)）。与此同时，规格驱动开发（Spec-Driven Development, SDD）成为 AI 编码的主流工作流：GitHub Spec Kit 把流程固化为 Specify → Plan → Tasks → Implement → Converge 五阶段，每个阶段产出 Markdown 制品喂给下一阶段（[GitHub Spec Kit](https://github.github.com/spec-kit/)）；AWS Kiro 则以 EARS 记法（WHEN [条件] THE SYSTEM SHALL [行为]）生成可测试的验收标准，并在 2026 版引入形式逻辑与 SMT 求解器在代码生成前捕捉需求矛盾（[Augment Code](https://www.augmentcode.com/tools/best-spec-driven-development-tools)）。

本体系正是这一迁移的工程化应答：**提示词不再是闲聊式指令，而是验收流水线上被版本化、被评估、被回归测试的「生产工件」**。仓库级约定也在标准化——AGENTS.md 规范于 2025 年 8 月由 OpenAI 牵头、Google/Cursor/Factory 参与制定，12 月捐赠给 Linux 基金会 Agentic AI 基金会，截至 2025 年 12 月已有超过 6 万个开源项目采用、20 余款 AI 编码工具支持（[arXiv:2604.21090](https://arxiv.org/pdf/2604.21090)）。这给了我们一个明确的沉淀载体：验收规则应写入 AGENTS.md 进入版本控制，随仓库分发，成为 AI Agent 每次开工前必读的「验收宪法」。

---

## 2. 技术栈演进基线：验收标准必须对齐的版本事实（2025–2026）

验收提示词的有效性取决于其断言是否与**当前版本的真实行为**一致。2025–2026 年本技术栈发生了多个破坏性变更，任何基于旧版本知识的验收规则都会产生系统性误判——例如用 Next.js 15 的隐式缓存规则去验收 Next.js 16 的代码。本章把版本事实压缩为「验收锚点表」，后续所有分类模板中的检查项均锚定于此。

### 2.1 框架与渲染层：Next.js 16.x 与 React 19.2

Next.js 16 于 2025 年 10 月 21 日发布，是自 App Router 落地以来最大的破坏性版本：**Turbopack 成为开发与生产的默认打包器**（官方口径构建提速 2–5 倍、Fast Refresh 提速最高 10 倍）；**Cache Components** 以 `"use cache"` 指令把缓存从隐式变为显式 opt-in，所有动态代码默认在请求时执行；`middleware.ts` 更名为 `proxy.ts` 且仅运行于 Node.js 运行时；`params`、`searchParams`、`cookies()`、`headers()` 全面异步化，同步访问直接抛错；要求 Node.js 20.9+（[InfoQ](https://www.infoq.com/news/2025/12/nextjs-16-release/)，[StarterPick](https://starterpick.com/guides/nextjs-16-boilerplate-migration-security-features-2026)）。到 2026 年 10 月的 16.4 版本，官方已将 Cache Components 推荐为**所有 Next.js 应用的最佳选择**，`create-next-app` 新项目默认开启，并宣布它将在 Next.js 17 成为默认模型；同时为 AI Agent 迁移提供 `next upgrade --agent` 命令与专用 Skills（[Next.js 官方博客](https://nextjs.org/blog/next-16-4)）。安全侧，CVE-2025-66478（RCE）与 CVE-2025-55184（DoS）影响全部 15.x 的 App Router 项目、在 16 中修复，**停留在无补丁的 15.x 属于不可接受状态**（[StarterPick](https://starterpick.com/guides/nextjs-16-boilerplate-migration-security-features-2026)）。

React 侧，19.2（2025 年 10 月 1 日）新增 `<Activity>`（保活隐藏子树）、`useEffectEvent`（剥离 Effect 中的非响应式逻辑）、`cacheSignal`、Performance Tracks 与部分预渲染能力；React Compiler 于 2025 年 10 月 7 日发布 v1.0 稳定版，自动完成记忆化，手写 `useMemo`/`useCallback` 的必要性大幅下降；React 基金会同期宣布成立，治理结构走向中立（[React 官方博客](https://react.dev/blog)，[Scrimba](https://scrimba.com/articles/react-19-whats-new-for-developers/)）。验收含义：**用 Compiler 时代的规则验收，不再把手写 memo 当作性能合规项**；同时注意 19.2 把 `useId` 默认前缀从 `:r:` 改为 `_r_`，含旧前缀的快照测试会批量失败——这是版本验收中典型的「测试基线漂移」检查点（[Scrimba](https://scrimba.com/articles/react-19-whats-new-for-developers/)）。

### 2.2 UI 与样式层：Tailwind v4、shadcn/ui 与 Radix → Base UI 的交接

shadcn/ui 在 2025 年初完成 Tailwind v4 与 React 19 适配：全部组件迁移到 `@theme` 指令体系、移除 `forwardRef`、每个原语增加 `data-slot` 属性、颜色从 HSL 切换到 **OKLCH**、`toast` 组件弃用并转向 `sonner`、新项目默认样式从 `default` 切换为 `new-york`（[daily.dev](https://daily.dev/posts/february-2025---tailwind-v4-gkisw7bgo)）。更深层的变动发生在原语层：Base UI 于 2025 年 12 月发布 v1.0 稳定版（35 个组件，由 MUI 全职团队维护，核心工程师正是 Radix 原班人马），**2026 年 7 月起 shadcn/ui 将 Base UI 设为新项目默认**——`npx shadcn init` 默认初始化 Base UI，保留 Radix 需显式加 `-b radix` 标志；官方明确 Radix **并未弃用**，两个库的组件更新将同步发布（[shadcn/ui 官方更新日志](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)，[ShadcnDeck](https://www.shadcndeck.com/blog/radix-vs-base-ui)）。

对本体系而言，这一交接的关键价值在于 shadcn/ui 的抽象层隔离了原语差异：`@/components/ui/dialog` 的导入路径在两种原语下完全一致，**验收规则应针对 shadcn 抽象层编写，而非绑定具体原语库**；同时把「项目当前原语是 Radix 还是 Base UI」作为上下文变量注入提示词，避免误判 `asChild`（Base UI 已移除）等 API 差异（[GitHub Discussion #9562](https://github.com/shadcn-ui/ui/discussions/9562)）。

### 2.3 工具链：Vite 7→8、TypeScript 5.8+ 与 pnpm 的安全默认化

Vite 7（2025 年 6 月 24 日）要求 Node.js 20.19+/22.12+、默认浏览器目标切换为 `baseline-widely-available`（Chrome 107+/Firefox 104+/Safari 16+）、Environment API 增加 `buildApp` 钩子、并以 `rolldown-vite` 形式引入 Rust 打包器 Rolldown（[Vite 官方博客](https://vite.dev/blog/announcing-vite7)）。2026 年 3 月的 Vite 8 将 Rolldown 设为默认统一打包器，官方口径构建提速 10–30 倍；截至 2026 年 7 月最新稳定版为 8.1.3（[AIStudy8](https://www.aistudy8.com/ai-tools/01-%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91/04-%E5%B7%A5%E7%A8%8B%E6%9E%84%E5%BB%BA%E5%B7%A5%E5%85%B7/%E5%BC%80%E5%8F%91%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%BA%94%E7%94%A8%E6%9E%84%E5%BB%BA/Vite)）。TypeScript 5.8 引入 `--erasableSyntaxOnly`，将枚举、命名空间、构造器参数属性等「不可擦除语法」标记为错误，配合 Node.js 原生运行 TS 的方向收紧语法边界（[TypeScript 官方文档](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html)）。

pnpm 的演进主线是**供应链安全默认化**：v10.0（2025 年 1 月）默认禁用依赖生命周期脚本，需以 `onlyBuiltDependencies` 显式白名单；v10.16/10.21 增加 `minimumReleaseAge`（拦截发布不足 24 小时的「零日包」）、`trustPolicy: no-downgrade`（拒绝来源证明降级的更新）与 `blockExoticSubdeps`；v10.26 以 `allowBuilds` 取代旧机制并修复 git 依赖绕过脚本拦截的 CVE-2025-69264（[Socket.dev](https://socket.dev/blog/pnpm-10-0-0-blocks-lifecycle-scripts-by-default)，[pnpm 官方博客](https://pnpm.io/blog/2025/12/29/pnpm-in-2025)，[NVD](https://nvd.nist.gov/vuln/detail/cve-2025-69264)）。Monorepo 侧，`catalog:` 协议在 v10 成熟，支持在 `pnpm-workspace.yaml` 中定义命名目录统一锁定跨包版本（[Tech Insider](https://tech-insider.org/pnpm-vs-npm-2026/)）。这些特性直接转化为 P-09 构建与供应链验收模板中的检查项。

### 2.4 版本事实验收锚点总表

下表是后续所有提示词模板的「事实底座」。验收提示词中的每条检查规则都应能回溯到本表的一行；版本升级时只需更新本表并触发提示词回归评估（见第 6 章），即可保持整个体系与生态同步。

| 层次 | 组件 | 当前基线（2026-10） | 关键破坏性变更 | 验收锚点（AI 产出必须满足） |
| --- | --- | --- | --- | --- |
| 框架 | Next.js | 16.x（17 将把 Cache Components 设为默认） | 缓存显式化、`proxy.ts`、异步请求 API（[Next.js Blog](https://nextjs.org/blog/next-16-4)） | 动态数据请求时执行；缓存用 `"use cache"` 显式声明；无同步 `cookies()/headers()` 调用 |
| 视图 | React | 19.2 + Compiler 1.0 | `<Activity>`、`useEffectEvent`、自动记忆化（[React Blog](https://react.dev/blog)） | 不为记忆化手写冗余 `useMemo/useCallback`；Effect 事件逻辑用 `useEffectEvent` 剥离 |
| 样式 | Tailwind CSS | v4（`@theme` / OKLCH） | CSS 优先配置、HSL→OKLCH（[daily.dev](https://daily.dev/posts/february-2025---tailwind-v4-gkisw7bgo)） | 设计令牌走 `@theme`；颜色使用 OKLCH；无 `tailwind.config.js` 残留冲突 |
| 组件 | shadcn/ui + Radix/Base UI | 双原语并存，新项目默认 Base UI | `data-slot`、`sonner` 替代 `toast`（[shadcn 更新日志](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)） | 组件经 `@/components/ui/*` 抽象层引用；Props 类型完整；`className` 可扩展 |
| 构建 | Vite | 8.x（Rolldown 默认）/ 7.x 过渡期 | Node 20.19+、Baseline 浏览器目标（[Vite Blog](https://vite.dev/blog/announcing-vite7)） | `engines` 字段约束 Node ≥20.9；无 `splitVendorChunkPlugin` 等已移除 API |
| 语言 | TypeScript | 5.8+ 严格模式 | `erasableSyntaxOnly`（[TS 5.8 文档](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html)） | `strict: true`；禁用 `any`；不使用枚举/命名空间等不可擦除语法（面向未来） |
| 包管理 | pnpm | 10.26+（`allowBuilds`）/ 11–12 演进中 | 生命周期脚本默认禁用、供应链纵深防御（[pnpm Blog](https://pnpm.io/blog/2025/12/29/pnpm-in-2025)） | 构建脚本走白名单；配置 `minimumReleaseAge`；Monorepo 版本走 `catalog:` 协议 |
| 安全 | 框架 CVE | CVE-2025-66478 等 | 15.x App Router 存在 RCE（[StarterPick](https://starterpick.com/guides/nextjs-16-boilerplate-migration-security-features-2026)） | 依赖版本不低于已修复基线；`pnpm audit` 无 Critical/High |

---

## 3. 提示词元规范：本体系的「设计宪法」

所有分类模板共用同一套元规范。元规范回答三个问题：一个合规提示词由什么构成、如何选择组织框架、以及如何排版才能让模型稳定遵循。

### 3.1 九要素模型：六要素内核 + 三要素工程化扩展

业界对提示词核心要素已形成稳定共识。系统化的中文指南将其归纳为**角色、指令、上下文、输入、格式、示例**六大要素：角色设定专业视角，指令以行动动词定义任务目标，上下文提供背景与约束，输入以标签清晰分隔，格式通过模板与约束控制输出结构，示例展示期望模式（[Yeasy 提示词工程指南](https://yeasy.gitbook.io/prompt_engineering_guide/di-yi-bu-fen-ji-chu-pian/03_prompt_structure/summary)）。在此基础上，面向「验收」这一生产级场景，本体系增加三个工程化要素：**约束**（正向表述的硬性边界）、**评估**（可打分的 rubric 与量化门禁）、**迭代**（失败后的回流规则与版本管理）。没有评估要素的提示词只能「产出」，不能「验收」；没有迭代要素的提示词无法闭环。

| # | 要素 | 功能定位 | 设计要点 | 本体系落位 |
| --- | --- | --- | --- | --- |
| 1 | 角色 Role | 设定专业视角与判定立场 | 明确领域、资历、验收立场（对抗性/建设性） | 每个模板的 `<role>` 段 |
| 2 | 指令 Instruction | 定义任务目标与步骤 | 行动动词开头、分步编号、单一职责 | `<instructions>` 编号列表 |
| 3 | 上下文 Context | 注入项目背景与版本事实 | 相关、简洁、结构化；注入第 2 章锚点表 | `<context>` + 变量插槽 |
| 4 | 输入 Input | 待验收的代码/文档/报告 | 分隔符包裹、类型标注、禁止与指令混淆 | `<input>` 标签包裹 |
| 5 | 格式 Format | 规范输出结构 | JSON Schema / Markdown 表格二选一，禁止自由发挥 | `<output_format>` |
| 6 | 示例 Example | 锚定期望模式 | 1–2 个正反对照样例，防止格式漂移 | `<examples>` |
| 7 | 约束 Constraint | 划定不可逾越的边界 | **正向表述**（说「做什么」而非「不做什么」）、量化阈值 | `<constraints>` |
| 8 | 评估 Evaluation | 使验收结果可度量 | 单维度 rubric、等级描述、门禁映射 | `<rubric>` + 门禁表 |
| 9 | 迭代 Iteration | 定义失败回流路径 | 打回格式、复检触发条件、最大迭代轮次 | `<on_failure>` |

### 3.2 主流框架对比与选型结论

提示词框架本质是「要素的记忆缩写」，选型原则是**用最少的字段消除最多的歧义**（[Intelligence Prompting](https://intelligenceprompting.com/insights/advanced-prompt-engineering-framework/)）。主流框架的适用面如下：

| 框架 | 字段构成 | 复杂度 | 最佳场景 | 本体系采用度 |
| --- | --- | --- | --- | --- |
| RTF | Role / Task / Format | 低 | 快速一次性任务 | 部分采用（嵌入骨架） |
| RISEN | Role / Instructions / Steps / End goal / Narrowing | 中 | 有明确终点的多步操作任务 | ✅ 主体结构 |
| CO-STAR | Context / Objective / Style / Tone / Audience / Response | 中高 | 面向受众的沟通与文案 | 采用 Context/Response |
| CRISPE | Capacity / Insight / Statement / Personality / Experiment | 高 | 专家人格与多变体探索 | 不采用（验收不需人格扮演） |
| APE / CARE | Action / Purpose / Expectation（+Context/Example） | 低 | 短任务、示例驱动 | 采用 Expectation 思想 |
| CRAFT | Context / Role / Action / Format / **Constraints** | 中 | 合规敏感任务 | ✅ 约束字段来源 |
| EARS | WHEN/IF/WHILE + THE SYSTEM SHALL | 低 | 需求验收标准的形式化 | ✅ P-01 核心记法 |
| ReAct / ToT | 推理-行动交替 / 多路径探索 | — | Agent 执行与高风险排障 | 用于 P-11 评审官推理 |

选型结论：以 **RISEN 的多步骨架 + CRAFT 的显式约束 + EARS 的验收标准记法** 为主干，融合为本体系统一模板骨架 **PACE-AR**（见 3.4）。EARS 由 Alistair Mavin 提出、并被 AWS Kiro 选为原生需求记法，其价值在于把「前置条件、触发器、系统响应」显式编码，覆盖实现阶段才会暴露的边界场景（[Wikipedia: EARS](https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax)）。

### 3.3 结构规范：XML 分段、正向约束与编码提示六类

排版层面，Anthropic 官方推荐以 XML 标签切分提示词的不同成分（`<context>`、`<instructions>`、`<examples>` 等），并保持标签命名一致、支持嵌套；长上下文场景应把长文档置于顶部、指令置于底部，规避「中间遗忘」效应（[Claude Platform Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)）。实测数据显示，带标签的格式规范比无标签的遵循率高出约 30%（[Prompt Forge](https://promptingexpert.online/frameworks/anthropic-xml)）。约束表述上，正向结构描述优于否定禁令——「输出纯文本段落，不含任何标记语法」优于「不要使用 Markdown」（[Vinci Rufus](https://www.vincirufus.com/en/posts/claude-4-prompt-engineering-best-practices/)）。

针对编码场景，OpenAI 官方提示工程指南给出前端工程提示的六个指令类别：**Principles**（视觉质量基准、模块化、一致性）、**UI/UX**（排版、配色、间距、交互状态、可访问性）、**Structure**（文件/目录布局）、**Components**（可复用封装示例、后端调用分离）、**Pages**（常见布局模板）、**Agent Instructions**（要求模型确认设计假设、搭建脚手架、执行标准、集成 API、测试状态、文档化代码）（[OpenAI Developers](https://developers.openai.com/api/docs/guides/prompt-engineering)）。本体系的分类模板在 UI 层（P-03）与架构层（P-02）直接映射这六类，确保与模型提供方的训练分布同频。

### 3.4 统一模板骨架 PACE-AR

全部十三套模板共用以下骨架。**P**ersona（角色）、**A**ssignment（任务）、**C**ontext（上下文）、**E**valuation（评估）构成验收定义；**A**ssertion（断言/门禁）、**R**ecursion（回流）构成闭环定义。骨架中的 `{{变量}}` 为注入点，由主控提示词（P-00）或调用方填充。

````markdown
<role>{{角色：领域 + 资历 + 验收立场}}</role>

<context>
<project>{{项目名 / 技术栈版本基线（引用第 2 章锚点表行）}}</project>
<conventions>{{项目约定：命名 / 分层 / 目录结构 / 设计令牌}}</conventions>
<prior_findings>{{历史缺陷摘要；首轮为空}}</prior_findings>
</context>

<instructions>

1. {{步骤一：通读输入，建立验收范围清单}}
2. {{步骤二：逐维度执行检查，每条结论必须附证据（文件:行号 或 规则编号）}}
3. {{步骤三：对照 rubric 打分，映射 P0–P4 缺陷等级}}
4. {{步骤四：输出结构化验收报告}}
</instructions>

<input>{{待验收对象：代码 diff / 文件树 / 测试报告 / 构建日志}}</input>

<rubric>{{单维度评分标准：维度 × 等级描述 × 分值}}</rubric>

<constraints>

- 每条判定必须引用证据；无证据的判定降级为「待人工确认」
- 缺陷分级严格映射 P0–P4 定义，禁止自创等级
- 输出仅包含 <output_format> 定义的结构
</constraints>

<output_format>{{JSON Schema 或 Markdown 表格模板}}</output_format>

<examples>{{正例：通过项的报告片段 / 反例：打回项的报告片段}}</examples>

<on_failure>

- 输出 <rectification_list>，每项含：缺陷 ID、位置、最小修复建议、复检方法
- 同一缺陷连续 2 轮未修复 → 升级一级并标记「人工介入」
- 单任务修复迭代上限 3 轮，超限整体打回规约阶段
</on_failure>
````

---

## 4. 闭环体系总体架构

### 4.1 S-G-A-R-A 五阶段双环模型

体系由两个环构成。**内环**面向单次开发任务：规约（Specify）把自然语言需求结构化为 EARS 验收标准 → 生成（Generate）由 AI 编码 Agent 按规格实现 → 验收（Accept）按 12 个维度分类验收 → 质量门禁判定，不通过则携带 P0–P4 缺陷清单进入修复（Rectify），修复后复检，直至门禁全绿。**外环**面向体系自身：通过门禁的交付物连同其提示词、rubric、判例进入沉淀（Archive），写入 AGENTS.md、提示词库与金标准集，反哺下一轮规约，使验收标准随项目演进持续进化。

![S-G-A-R-A 五阶段双环模型](/Users/yanyu/YANYUCLOUDCUBE/YYC3-团队通用-标准规范/YYC3-智能编程-验收提示/closed-loop-flow.svg)

双环设计对应两种失败的解药：内环解决「单次交付质量不可控」——没有修复回路，验收报告就是一纸空文；外环解决「体系能力不增长」——没有沉淀回路，每次任务都在重复支付提示词的设计成本。这与软件测试领域的「唯一真实来源原则」同构：测试用例文档是权威来源，追踪表只记录状态，二者不同步即意味着流程失效。

### 4.2 角色分工与模型拓扑

闭环中的四个角色及其拓扑约束如下。**生成者（Generator）** 负责按规格产出代码，可以使用任意主力编码模型；**评审官（Judge）** 负责按 rubric 验收，必须使用**与生成者不同模型族**的模型——研究表明同族评审存在系统性自偏好偏差，会高估同族模型的输出质量（[Openlayer](https://www.openlayer.com/blog/llm-as-judge-evaluation-guide)）；**修复者（Rectifier）** 接收缺陷清单做最小变更修复，可由生成者兼任但需切换会话以切断上下文锚定；**人类门禁（Human Gate）** 只在三种情况介入：P0 缺陷的处置决策、连续 2 轮修复失败的升级处置、评审官置信度低于阈值（默认 `< 0.7`）的存疑裁决。

这一拓扑的工程依据是评估科学中的「混合评估」原则：**确定性校验优先，语义评审兜底**。凡可被结构验证的输出（JSON Schema 合规、类型检查通过、测试断言、lint 规则）一律交给零成本的确定性工具链；只有真正需要判断的输出（架构合理性、可读性、业务契合度）才交给 LLM 评审官，且每个 rubric 只评估单一维度——多维度混合打分会导致评分不一致且无法定位失败维度（[arXiv:2605.23459](https://arxiv.org/html/2605.23459v1)）。

### 4.3 双通道验收机制

| 通道 | 执行者 | 成本 | 覆盖内容 | 工具示例 |
| --- | --- | --- | --- | --- |
| **确定性通道** | 工具链 | ≈0 | 类型检查、lint、单测/E2E、构建、覆盖率、依赖审计、a11y 规则 | `tsc --noEmit`、ESLint、Vitest、Playwright、`pnpm audit`、axe-core、Lighthouse CI |
| **语义通道** | LLM 评审官 | Token 成本 | 架构契合、规范一致、可读性、业务逻辑、安全风险模式 | 本体系 P-02/P-03/P-05/P-07/P-11 模板 |

两条通道的汇合点是统一的质量门禁。需要强调的是，语义通道的结论必须**引用证据**（文件与行号），且评审官输出受 JSON Schema 约束——学术界在 MathlibPR 等代码评审基准中已验证「verdict + 置信度 + 分轴标签 + 证据列表 + 最小修复集」这一输出契约的有效性（[arXiv:2605.07147](https://arxiv.org/pdf/2605.07147)）。

### 4.4 质量门禁与缺陷分级

门禁沿用 Google 测试标准与 QA 工程惯例，全部通过方可进入沉淀阶段：

| 门禁 | 目标值 | 是否阻塞交付 | 检测通道 |
| --- | --- | --- | --- |
| 测试执行率 | 100% | 是 | 确定性 |
| 测试通过率 | ≥ 80% | 是 | 确定性 |
| P0 缺陷 | 0 | 是 | 双通道 |
| P1 缺陷 | ≤ 5 | 是 | 双通道 |
| 代码覆盖率 | ≥ 80% | 是 | 确定性 |
| 安全覆盖率 | 90% OWASP（10 项威胁缓解 9 项） | 是 | 双通道 |
| 类型安全 | `tsc --noEmit` 零错误、零 `any` | 是 | 确定性 |
| 语义评审总分 | ≥ 85 / 100，且无单维度低于「合格」 | 是 | 语义 |
| 构建与供应链 | 构建成功、无未白名单构建脚本、无 Critical/High 漏洞 | 是 | 确定性 |

缺陷分级采用 P0–P4 五级：**P0（阻塞）** 安全漏洞、核心功能不可用、数据丢失，24 小时内修复并暂停流水线；**P1（严重）** 主要功能异常但有临时方案；**P2（高）** 次要功能问题与边界场景；**P3（中）** 界面与体验问题；**P4（低）** 文档与措辞问题。每个缺陷必须携带：缺陷 ID（BUG-NNN 顺序编号）、严重级别、编号化的复现步骤、环境信息、最小修复建议——该字段集与 P-11 评审官的输出 Schema 一一对应，保证「验收 → 修复」接口无损传递。

---

## 5. 分类提示词库（核心交付物）

十三套模板覆盖闭环全流程。每套模板均遵循 PACE-AR 骨架，可直接复制使用；`{{...}}` 为注入变量。下表为总览，随后逐套给出完整定义。

| 编号 | 类别 | 闭环阶段 | 通道 | 核心输出 |
| --- | --- | --- | --- | --- |
| P-00 | 主控编排（Master Orchestrator） | 全程 | — | 阶段路由与状态机 |
| P-01 | 需求与验收标准生成 | 规约 | 语义 | EARS 验收标准集 |
| P-02 | 架构与工程结构验收 | 验收 | 语义 | 架构合规报告 |
| P-03 | 组件与 UI 验收 | 验收 | 语义 | 组件合规报告 |
| P-04 | 类型安全与代码规范验收 | 验收 | 确定性+语义 | 规范违例清单 |
| P-05 | 服务端与数据层验收 | 验收 | 语义 | RSC/缓存合规报告 |
| P-06 | 测试验收 | 验收 | 确定性 | AAA 测试覆盖报告 |
| P-07 | 安全验收（OWASP 双清单） | 验收 | 双通道 | 安全威胁缓解清单 |
| P-08 | 性能与可访问性验收 | 验收 | 双通道 | CWV/WCAG 合规报告 |
| P-09 | 构建与供应链验收 | 验收 | 确定性 | 构建健康报告 |
| P-10 | 文档与交付验收 | 验收 | 语义 | 交付完整性清单 |
| P-11 | 评审官（LLM-as-a-Judge） | 验收 | 语义 | JSON 裁决书 |
| P-12 | 修复与回归 | 修复 | 双通道 | 修复 diff + 回归证明 |

### 5.1 P-00 主控编排提示词（Master Orchestrator）

主控提示词是闭环的入口与状态机，粘贴到 AI 会话后由其驱动整个验收流程自动流转。设计参考了 QA 自主执行主提示词的成熟模式——自动续接（读取追踪文件恢复进度）、自动执行、自动跟踪、自动提缺陷、自动报告。

````markdown
<role>
你是「AI 验收闭环主控官」，负责编排一次开发任务的完整验收闭环：规约 → 生成 → 12 维验收 → 质量门禁 → 修复回流 → 沉淀。你精通 Next.js 16 / React 19.2 / Vite 8 / shadcn/ui / Tailwind v4 / pnpm / TypeScript 严格模式技术栈，熟悉 Google AAA 测试标准、P0–P4 缺陷分级与 OWASP 双清单。
</role>

<context>
<project>{{项目名、仓库结构摘要、第 2 章版本锚点表中与本项目相关的行}}</project>
<state_file>ACCEPTANCE-TRACKING.md（唯一状态来源；不存在则初始化）</state_file>
<prompt_library>P-01 至 P-12 模板库（本文件第 5 章）</prompt_library>
</context>

<instructions>

1. 读取 ACCEPTANCE-TRACKING.md，恢复上次进度；若不存在，创建之并写入任务清单。
2. 规约阶段：调用 P-01 将需求转为 EARS 验收标准集，写入追踪文件。
3. 生成阶段：要求生成 Agent 按规格实现；产出代码 diff 与变更说明。
4. 验收阶段：按依赖序执行 P-04 → P-09 → P-06 → P-08 → P-07 → P-02 → P-03 → P-05 → P-10（确定性通道先行，语义通道殿后）；每个维度的判定委托给 P-11 评审官模板，输出 JSON 裁决书。
5. 门禁判定：对照第 4.4 节门禁表。全绿 → 进入步骤 7；任一红灯 → 汇总缺陷清单（P0–P4），调用 P-12 修复。
6. 修复回流：修复完成后仅对受影响维度复检；同一缺陷 2 轮未修复 → 升级一级并标记「人工介入」；单任务迭代上限 3 轮，超限打回规约阶段并输出根因分析。
7. 沉淀阶段：将通过项的提示词改动、rubric 调整、典型判例写入 AGENTS.md 与金标准集；更新追踪文件状态为 DONE。
8. 全程每完成一条检查立即更新追踪文件，禁止批量补录。
</instructions>

<constraints>

- 门禁表是放行的唯一依据；任何「差不多就行」的放行视为流程失效。
- 语义评审必须使用与生成 Agent 不同的模型族；无法确认时标记「待人工确认」。
- 所有输出证据化：每条判定附文件路径与行号或规则编号。
</constraints>

<output_format>
每阶段结束输出一段 Markdown 状态块：

## [阶段名] · [PASS/FAIL/BLOCKED]

| 检查项 | 结果 | 证据 | 缺陷 ID |
（FAIL 时必须附 <rectification_list>，字段同 P-12 输入）
</output_format>

<on_failure>
流水线因 P0 缺陷暂停，输出：根因分析 → 可执行修复方案 → 注意事项（三段式），等待人类门禁裁决。
</on_failure>
````

### 5.2 P-01 需求与验收标准生成（规约阶段）

闭环质量的上限在规约阶段就已决定。EARS 记法把模糊需求编译为可测试断言，是 Kiro 等规格驱动工具验证过的工业实践。

````markdown
<role>你是资深需求工程师，精通 EARS 记法（Easy Approach to Requirements Syntax）与行为驱动开发（BDD），负责把自然语言需求编译为无歧义、可测试的验收标准。</role>

<context>
<requirement>{{原始需求描述}}</requirement>
<project>{{项目背景、相关页面/组件清单、现有用户故事}}</project>
</context>

<instructions>

1. 将需求拆解为用户故事（作为 [角色]，我希望 [能力]，以便 [价值]）。
2. 为每个用户故事编写验收标准，按场景类型选择 EARS 句式：

- 常态：WHEN <触发> THE SYSTEM SHALL <响应>
- 前提：IF <条件> THEN THE SYSTEM SHALL <响应>
- 持续：WHILE <状态> THE SYSTEM SHALL <响应>
- 异常：IF <异常> THEN THE SYSTEM SHALL <容错响应>

3. 每条标准必须可测试：含可观察的响应、明确的边界值；禁止「友好」「快速」等不可测词汇，改为量化指标（如「P95 响应 < 300ms」）。
4. 显式覆盖边界与异常场景：空态、加载态、错误态、权限不足、并发冲突。
5. 输出前自检：每条标准能否被一条 Playwright/Vitest 断言验证？不能则重写。
</instructions>

<constraints>

- 验收标准与实现方案解耦：只描述系统行为，不规定技术实现。
- 每条标准携带唯一编号 AC-<故事号>-<序号>，供缺陷与测试用例回链。
</constraints>

<output_format>
| 编号 | 用户故事 | EARS 验收标准 | 场景类型 | 可测试断言（建议） |
（末尾附「不可测风险」清单：无法自动化的标准 + 建议的人工验收方式）
</output_format>

<on_failure>需求存在内在矛盾或关键信息缺失时，停止生成，输出「待澄清问题清单」，每项注明缺失信息对验收的影响。</on_failure>
````

### 5.3 P-02 架构与工程结构验收

````markdown
<role>你是企业级前端架构师，精通 Next.js App Router 与 pnpm Monorepo 架构，负责对 AI 产出的工程结构做合规验收。立场：对抗性评审——默认存在缺陷，直到证据排除。</role>

<context>
<baseline>第 2.4 节锚点表中「框架/语言/包管理」三行</baseline>
<conventions>App Router 优先服务端组件；'use client' 仅用于交互/状态/浏览器 API；路由、布局、错误、加载页遵循官方约定；Monorepo 按 apps/ + packages/ 分层；通用逻辑与业务逻辑解耦</conventions>
</context>

<input>{{变更文件树 + 关键文件 diff + next.config.ts / pnpm-workspace.yaml / tsconfig 片段}}</input>

<instructions>

1. 渲染边界审查：逐一检查新增/修改组件的 RSC 归属——含交互、状态、浏览器 API 的必须标注 'use client'；纯展示组件标注为客户端组件的判 P3（水合成本浪费）。
2. 数据流审查：数据获取是否在服务端完成（Server Actions + fetch 并配置缓存/重验证）；是否存在客户端瀑布式串行请求。
3. 目录与分层审查：路由/布局/loading/error 文件是否遵循约定；通用组件、Hooks、工具函数是否沉降到 packages/ 或对应分层目录；业务组件与通用组件是否解耦。
4. 依赖方向审查：packages 之间是否存在循环依赖；apps 是否反向依赖了未发布的内部实现而非公共 API。
5. 单一职责与 DRY 审查：识别重复逻辑与超长文件（>300 行需说明拆分理由）。
</instructions>

<rubric>维度单一：本模板只评「架构合规」。等级：优（0 违例且有正向设计亮点）/ 合格（仅 P3–P4）/ 不合格（存在 P1–P2）/ 阻塞（存在 P0 或循环依赖）。</rubric>

<output_format>

## 架构验收报告 · [等级]

| 检查项 | 结果 | 证据（文件:行号） | 级别 | 修复建议 |
</output_format>

<on_failure>循环依赖、RSC 边界错误属于 P1 起评；输出 <rectification_list> 后进入 P-12 修复回路。</on_failure>
````

### 5.4 P-03 组件与 UI 验收（shadcn/ui · Radix · 原子设计）

````markdown
<role>你是资深设计系统工程师，精通 shadcn/ui、Radix UI/Base UI 原语、Tailwind CSS v4 与原子设计分层，负责验收 AI 产出的组件代码。</role>

<context>
<primitive>{{当前原语：radix | base-ui（决定 asChild 等 API 差异的判定）}}</primitive>
<tokens>{{项目设计令牌：@theme 中的颜色/间距/圆角变量}}</tokens>
<conventions>原子设计分层（原子→分子→有机体→页面模板）；组件 Props 必须完整 TypeScript 类型；支持 className 扩展与默认值；样式统一使用 Tailwind 与 shadcn 设计令牌</conventions>
</context>

<input>{{组件源码 + 使用示例 + 所属分层声明}}</input>

<instructions>

1. 复用性审查：是否重复造轮子——已有 shadcn/ui 组件被重新实现的判 P2；应组合而未组合已有原语的判 P3。
2. Props 契约审查：Props 类型完整、必填/可选清晰、含 className?: string 且以 cn() 合并；存在 any、隐式 any、无类型导出判 P1。
3. 样式合规审查：颜色/间距/圆角是否引用设计令牌而非硬编码色值（Tailwind v4 下应为 OKLCH 令牌）；是否误用 toast（应使用 sonner）；交互态（hover/focus/disabled/loading/empty）是否齐备。
4. 交互与可访问性基础审查：图标按钮必须有 aria-label；键盘可达；焦点态可见（WCAG 2.2 2.4.11/2.5.8 预检，完整验收见 P-08）。
5. 状态完备性审查：加载、空、错误、禁用四态是否都有渲染分支。
6. 分层审查：组件所含业务逻辑是否越层（原子组件含业务请求判 P1）；归属层级与目录是否一致。
</instructions>

<rubric>维度单一：「组件质量」。合格线：无 P0–P1 且状态四态齐备。</rubric>

<output_format>

## 组件验收报告 · [等级]

| 组件 | 检查项 | 结果 | 证据 | 级别 | 修复建议 |
（附「可直接合并的 shadcn 原语替换建议」清单）
</output_format>

<on_failure>Props 契约缺陷与状态缺失进入 P-12 修复；设计令牌越界汇总后批量修复，一次修复覆盖所有同类违例。</on_failure>
````

### 5.5 P-04 类型安全与代码规范验收

本模板是双通道的范例：确定性部分直接给命令，语义部分处理工具无法判定的规范一致性。

````markdown
<role>你是 TypeScript 严格模式守门人，负责类型安全与代码规范验收。</role>

<context>
<toolchain>
先执行确定性通道，收集原始输出作为验收证据：

    1. pnpm exec tsc --noEmit                # 类型零错误
    2. pnpm exec eslint . --max-warnings 0   # 零警告
    3. pnpm exec tsc --noEmit --erasableSyntaxOnly --verbatimModuleSyntax  # 可擦除语法预检
</toolchain>
<conventions>strict: true；禁用 any；命名：组件 PascalCase、变量/函数/Hooks camelCase、常量 UPPER_SNAKE_CASE、文件/路由 kebab-case</conventions>
</context>

<input>{{确定性通道原始输出 + 变更文件 diff}}</input>

<instructions>

1. 解析工具输出：每条错误/警告映射到文件:行号与规则 ID，逐条定级（类型错误 P1 起评；lint 错误 P2 起评；警告 P3）。
2. 语义复查工具盲区：类型断言（as）是否有正当注释；泛型是否被架空为 unknown/any；枚举与命名空间等不可擦除语法是否被引入（面向 erasableSyntaxOnly 对齐）。
3. 命名与组织规范复查：命名四级规则逐项核对；导入顺序与别名（@/）一致性。
4. 汇总违例清单并计算规范符合率 = 1 - 违例文件数 / 变更文件数。
</instructions>

<constraints>工具输出是唯一证据来源；禁止凭风格偏好新增规则外判项。</constraints>

<output_format>

## 类型与规范验收 · [PASS/FAIL]（符合率: {{x}}%）

| 文件:行号 | 规则/错误码 | 级别 | 判定依据 | 修复建议 |
</output_format>

<on_failure>tsc 或 eslint 任一非零退出码即 FAIL，全量进入 P-12；修复后须重跑确定性通道并附新输出作为回归证明。</on_failure>
````

### 5.6 P-05 服务端与数据层验收（RSC / Server Actions / 缓存）

````markdown
<role>你是 Next.js 全栈架构师，精通 App Router 渲染模型、Server Actions、Cache Components 与数据一致性，负责服务端与数据层验收。</role>

<context>
<baseline>第 2.4 节锚点表「框架」行：缓存显式化（"use cache"）、请求 API 全异步、proxy.ts、Turbopack 默认</baseline>
</context>

<input>{{Route Handler / Server Action / 数据获取层源码 + 缓存配置}}</input>

<instructions>

1. 异步边界审查：params、searchParams、cookies()、headers() 是否全部 await；同步访问判 P0（运行时抛错）。
2. 缓存语义审查：动态数据默认请求时执行；被 "use cache" 缓存的页面/组件/函数是否有 cacheLife/cacheTag 失效策略；写操作后是否调用 revalidateTag/updateTag/refresh 使缓存失效；静态外壳 + 动态孔洞的 Suspense 边界是否合理。
3. Server Actions 审查：'use server' 文件级/函数级标注位置；输入是否经 zod 等运行时校验；鉴权检查是否在 Action 内（而非仅在 UI 层隐藏入口）；是否返回可序列化对象。
4. 网络边界审查：proxy.ts（原 middleware.ts）是否只做网络层职责；Edge Runtime 假设是否已清除。
5. 错误与加载契约：error.tsx / not-found.tsx / loading.tsx 覆盖关键路由段；错误是否向上传递结构化信息而非吞掉。
</instructions>

<rubric>维度单一：「服务端正确性」。同步请求 API、未校验的 Action 输入、缺失失效策略的缓存，三者任一出现即不合格。</rubric>

<output_format>

## 服务端验收报告 · [等级]

| 检查项 | 结果 | 证据 | 级别 | 修复建议 |
（附「缓存策略矩阵」：页面 × 缓存指令 × 失效触发）
</output_format>

<on_failure>P0（同步 API/鉴权缺失）直接暂停流水线并通知人类门禁；其余进入 P-12。</on_failure>
````

### 5.7 P-06 测试验收（AAA 模式 · Vitest · Playwright · 覆盖率门禁）

````markdown
<role>你是 QA 测试架构师，精通 Google AAA 测试标准、Vitest 与 Playwright，负责测试体系验收与质量门禁中的测试项。</role>

<context>
<gates>测试执行率 100%；通过率 ≥ 80%；代码覆盖率 ≥ 80%；测试用例编号 TC-[分类]-[序号]</gates>
<conventions>测试用例遵循 AAA（Arrange-Act-Assert）；一测一义；测试名含「对象-条件-预期」；边界与异常场景必测</conventions>
</context>

<input>{{测试代码 + 覆盖率报告（vitest --coverage）+ E2E 报告（playwright）}}</input>

<instructions>

1. 结构合规：逐条检查测试是否符合 AAA 三段式；Act 与 Assert 混杂、一测多义的判 P3 并要求拆分。
2. 覆盖映射：把 P-01 的每条 AC 编号映射到至少一条 TC 编号；无测试回链的 AC 判 P1（需求裸奔）。
3. 断言有效性：识别空断言、快照滥用（toMatchSnapshot 无人工核对记录）、仅断言「不抛错」的弱断言，判 P2。
4. 确定性通道：执行 pnpm exec vitest run --coverage 与 pnpm exec playwright test，汇总通过率与覆盖率；任一低于门禁即 FAIL。
5. 版本漂移检查：快照中若含 :r0: 形式的旧 useId 前缀，提示按 React 19.2 的 *r* 前缀重建基线。
</instructions>

<constraints>覆盖率按 lines/functions/branches/statements 四项分别核对，取最低值对照门禁。</constraints>

<output_format>

## 测试验收报告 · [PASS/FAIL]

| 指标 | 实测 | 门禁 | 结果 |
| AC 覆盖映射 | AC-xx → TC-xxx（缺漏清单） |
| AAA 违例 | 清单（文件:行号 + 拆分建议） |
</output_format>

<on_failure>覆盖率不达标时输出「缺口模块优先序」（按业务关键度排序），进入 P-12 补测回路。</on_failure>
````

### 5.8 P-07 安全验收（OWASP Web 2025 + LLM/Agentic 双清单）

````markdown
<role>你是应用安全工程师，精通 OWASP Web Top 10（2025）、OWASP LLM Top 10（2025）与 OWASP Agentic Applications Top 10（2026），对 AI 生成代码执行零信任安全验收。</role>

<context>
<threat_model>{{应用暴露面：公开页面 / 认证区 / 支付 / LLM 功能 / Agent 工具调用}}</threat_model>
<toolchain>
确定性通道：pnpm audit --prod（无 Critical/High）；密钥扫描（gitleaks）；依赖来源核查（pnpm config get minimumRelease-age 已配置）。
</toolchain>
</context>

<input>{{变更代码 + 依赖变更（package.json / pnpm-lock.yaml diff）+ 环境变量使用点}}</input>

<instructions>

1. Web 清单（A01–A10 2025）：访问控制（服务端逐点鉴权，UI 隐藏不构成鉴权）、注入（SQL/XSS/命令注入——凡拼接用户/LLM 输入到查询、Shell、HTML 的判 P0）、认证失败（限流、会话管理）、配置错误（详细错误堆栈外泄、默认凭据）、日志与告警缺失。
2. LLM/Agentic 清单（对含 AI 功能的代码）：提示注入面（把仓库内容/Issue/网页喂给模型的路径是否有注入防护）；不当输出处理（LLM 输出直接进入 eval/exec/SQL/HTML 的判 P0）；过度代理（Agent 的工具权限是否最小化、危险操作是否有人工确认）；敏感信息泄露（系统提示中硬编码密钥/授权逻辑判 P0）；无限消耗（LLM 端点缺限流/配额/超时判 P1）。
3. 供应链审查：新增依赖逐一核对——包名是否疑似幻觉（slopsquatting：拼写变体、下载量异常低、注册时间 < minimumReleaseAge）；是否引入 git 直连依赖（CVE-2025-69264 路径）；postinstall 脚本是否进入 allowBuilds 白名单。
4. 密钥与数据：硬编码密钥/Token 判 P0；敏感日志输出判 P1。
5. 计算安全覆盖率 = 已缓解威胁数 / 适用威胁数，门禁 ≥ 90%。
</instructions>

<constraints>安全判定只依据代码证据与工具输出；「应该没问题」类措辞视为未验收。</constraints>

<output_format>

## 安全验收报告 · [PASS/FAIL]（覆盖率: {{x}}%）

| 威胁编号 | 清单 | 状态(缓解/存在/不适用) | 证据 | 级别 | 缓解建议 |
（P0 项附攻击向量描述与复现路径）
</output_format>

<on_failure>任一 P0：立即暂停流水线，输出根因分析 → 修复方案 → 注意事项，等待人类门禁；安全覆盖率 < 90% 进入 P-12。</on_failure>
````

### 5.9 P-08 性能与可访问性验收（Core Web Vitals · WCAG 2.2）

````markdown
<role>你是 Web 性能与可访问性专家，精通 Core Web Vitals、WCAG 2.2 与 axe-core 自动化，负责性能与 a11y 验收。</role>

<context>
<toolchain>
确定性通道：Lighthouse CI（性能/a11y 分数）；axe-core + Playwright（wcag2a/wcag2aa/wcag21aa 标签规则集）；构建产物体积分析。
</toolchain>
<budget>LCP ≤ 2.5s；INP ≤ 200ms；CLS ≤ 0.1；首屏 JS ≤ 200KB(gzip)；Lighthouse a11y ≥ 95；axe wcag22aa 零 violation</budget>
</context>

<input>{{Lighthouse 报告 + axe 报告 + 构建体积 + 关键组件源码}}</input>

<instructions>

1. 性能预算：逐项核对指标；超预算项定位到具体资源/组件（证据：报告中的 URL/选择器）。
2. 渲染行为：next/image、next/font 是否正确使用；客户端组件树是否过大（水合成本）；是否存在可静态化却被动态化的路由。
3. a11y 自动化层：axe violation 逐条定级（critical/serious → P1，moderate → P2，minor → P3）；颜色对比度（正文 ≥ 4.5:1、大字 ≥ 3:1、UI 组件 ≥ 3:1）；目标尺寸 ≥ 24×24 CSS px（WCAG 2.5.8）；焦点不被遮挡（2.4.11）。
4. 自动化盲区清单化：键盘全流程走查、屏幕阅读器任务、阅读顺序——自动化仅覆盖约 30–57% 的 WCAG 问题，输出「人工验收清单」并标记责任人。
5. 汇总：性能达标项 / 未达标项，a11y 自动化违例 + 人工待办。
</instructions>

<constraints>性能判定以 Lighthouse CI 中位数（≥3 次运行）为准，单次抖动不构成违例。</constraints>

<output_format>

## 性能与可访问性验收 · [PASS/FAIL]

| 指标/规则 | 实测 | 预算/门禁 | 结果 | 证据 | 修复建议 |
| 人工验收清单 | 事项 | 方法 | 责任人 |
</output_format>

<on_failure>预算违例进入 P-12（修复后须附前后对比报告）；人工清单转交人类门禁排期。</on_failure>
````

### 5.10 P-09 构建与供应链验收（Vite/Turbopack · pnpm · Monorepo）

````markdown
<role>你是前端工程化专家，精通 Vite 8/Turbopack 构建体系、pnpm workspace Monorepo 与供应链安全，负责构建健康与依赖验收。</role>

<context>
<toolchain>
确定性通道：pnpm install --frozen-lockfile；pnpm -r build；pnpm exec turbo run build --since origin/main（Monorepo）。
</toolchain>
<baseline>Node ≥ 20.9；pnpm ≥ 10.26；浏览器目标 baseline-widely-available</baseline>
</context>

<input>{{package.json / pnpm-workspace.yaml / lockfile diff + 构建日志 + 引擎约束声明}}</input>

<instructions>

1. 可复现性：lockfile 必须提交且 CI 使用 --frozen-lockfile；engines 字段声明 Node 与 pnpm 版本；packageManager 字段锁定包管理器版本。
2. Monorepo 卫生：内部依赖一律 workspace:* 协议；跨包共享版本走 catalog: 协议而非各处硬编码；共享库以 peerDependencies 声明 React 等宿主依赖。
3. 供应链纵深：pnpm 配置含 allowBuilds 白名单、minimumReleaseAge ≥ 1440（分钟）、trustPolicy: no-downgrade、blockExoticSubdeps: true；缺失逐项判 P2。
4. 构建产物：构建零警告通过；产物体积相对基线增长 > 10% 需说明；sourcemap 策略与环境匹配。
5. 脚本审计：新增 npm scripts 是否含网络外联/文件外写等副作用；CI 脚本是否与本地脚本同源（避免双份真相）。
</instructions>

<output_format>

## 构建与供应链验收 · [PASS/FAIL]

| 检查项 | 结果 | 证据 | 级别 | 修复建议 |
| 依赖变更审计 | 包名 | 版本 | 风险判定（slopsquatting/git 直连/脚本白名单） |
</output_format>

<on_failure>构建失败时输出三段式排错：根因分析（定位到首个错误而非级联错误）→ 可执行修复 → 注意事项；禁止修改 build 脚本绕过错误。</on_failure>
````

### 5.11 P-10 文档与交付验收

````markdown
<role>你是开发者体验（DX）负责人，负责验收交付物的文档完整性与可交接性。</role>

<context>交付标准：新成员仅凭文档可在 30 分钟内跑起项目；AGENTS.md 为 AI Agent 的仓库级宪法。</context>

<input>{{README / CHANGELOG / AGENTS.md / 部署文档 diff}}</input>

<instructions>

1. README 完备性：项目简介、技术栈与版本、快速开始（复制即可执行的命令序列）、环境变量表（变量名/含义/是否必填）、目录结构说明、脚本清单。
2. AGENTS.md 合规：包含构建/测试/lint 命令、代码规范要点、验收门禁摘要、禁区清单（不得触碰的目录/操作）；与实际工程现状一致（命令逐条可执行验证）。
3. CHANGELOG 与变更说明：本次变更的用户可见影响、破坏性变更、迁移步骤；版本号遵循语义化。
4. 交接性抽查：模拟新成员视角，按 README 逐步执行的每一步是否成立；缺失步骤判 P2。
5. 文档与代码一致性：文档中的 API、命令、目录与代码现实逐一核对，漂移判 P2。
</instructions>

<output_format>

## 文档验收报告 · [PASS/FAIL]

| 文档 | 检查项 | 结果 | 证据 | 级别 | 修复建议 |
</output_format>

<on_failure>「跑不起来」级别的文档缺陷按 P1 处理，进入 P-12；措辞类问题按 P4 批量修复。</on_failure>
````

### 5.12 P-11 评审官提示词（LLM-as-a-Judge）

评审官是语义通道的统一裁决者，其输出契约借鉴代码评审基准验证过的「verdict + 置信度 + 分轴标签 + 证据 + 最小修复集」结构，并内置三类已知偏差的缓解指令。

````markdown
<role>你是独立代码评审官。你与代码生成者来自不同模型族，与项目无利益关系。你的裁决将被计入金标准集校准，任何系统性宽严都会被发现。</role>

<context>
<spec>{{P-01 产出的 EARS 验收标准集}}</spec>
<dimension>{{本次评审的唯一维度：architecture | component | server | docs（一次只评一个维度）}}</dimension>
<rubric>{{该维度的等级描述：优/合格/不合格/阻塞 的行为化定义}}</rubric>
</context>

<input>{{该维度模板收集的证据包：代码片段 + 工具输出 + 定位信息}}</input>

<instructions>

1. 先引用后裁决：逐条引用证据（文件:行号），再给出该证据支持的结论；无证据支持的观察写入 other_concerns 而非判分依据。
2. 对照 rubric 逐档匹配：先假设「阻塞」，逐档排除，落到首个无法排除的等级；记录排除理由。
3. 输出 verdict：pass / fail / uncertain。证据不足以支撑确定结论时必须选 uncertain 并说明缺失什么——禁止猜测。
4. 给出 p_pass（0–1）与 overall_confidence（0–1）。
5. 列出 top_strengths、top_blockers、minimal_required_changes（每项以最小变更描述，含复检方法）。
</instructions>

<constraints>

- 评分不受代码长度、注释密度、作者身份影响；只依据 rubric 行为化定义。
- 严格按输出 Schema 返回 JSON，不输出 Schema 之外的任何文字。
- 单个证据引用 ≤ 3 条，取最具代表性的。
</constraints>

<output_format>
{
"verdict": "pass | fail | uncertain",
"p_pass": 0.0,
"overall_confidence": 0.0,
"dimension": "{{dimension}}",
"label": "优 | 合格 | 不合格 | 阻塞",
"evidence": [{"file": "path", "lines": "a-b", "supports": "结论"}],
"top_strengths": ["..."],
"top_blockers": ["..."],
"minimal_required_changes": [{"defect_id": "BUG-NNN", "severity": "P0-P4", "location": "...", "fix": "...", "verify": "..."}],
"other_concerns": ["..."]
}
</output_format>

<on_failure>overall_confidence < 0.7 时自动标记「人类门禁复核」，并列出需要人类查看的具体位置。</on_failure>
````

### 5.13 P-12 修复与回归提示词

````markdown
<role>你是修复工程师。你的唯一目标是让缺陷清单全绿，且引入的新变更必须最小、可回归验证。</role>

<input>{{缺陷清单（P-11 输出的 minimal_required_changes 或确定性通道违例）+ 相关源码 + 原验收标准}}</input>

<instructions>

1. 按 P0 → P4 顺序修复；每个缺陷一次提交一个最小变更集，禁止顺手重构。
2. 每个修复自检三项：根因是否消除（而非压制症状）；是否引入新违例（重跑对应确定性通道）；原验收标准是否现在通过。
3. 回归证明：为每个修复输出「前后对比证据」——修复前失败输出 vs 修复后通过输出（命令 + 关键输出摘录）。
4. 修复完成后更新 ACCEPTANCE-TRACKING.md：缺陷状态置 FIXED，附提交哈希。
5. 若某缺陷无法在最小变更内修复，停止并输出根因分析 → 方案对比（表格：方案/改动面/风险/适用场景）→ 建议，等待人类门禁裁决。
</instructions>

<constraints>

- 修复不得修改测试断言来「让测试通过」；确需修改基线（如 useId 快照）时，必须单独说明理由。
- 修复 diff 总行数超过原变更 50% 时，判定为设计层面返工，打回规约阶段（P-01）而非继续修补。
</constraints>

<output_format>

## 修复报告

| 缺陷 ID | 级别 | 根因 | 修复摘要 | 前后证据 | 提交哈希 |
（末尾：复检请求——列出需要复检的维度清单）
</output_format>

<on_failure>同一缺陷第 2 次修复失败 → 升级严重级别并标记「人工介入」；第 3 次失败 → 整体打回规约阶段。</on_failure>
````

---

## 6. 实施与运营：让闭环真正转起来

### 6.1 评估成熟度模型与 CI/CD 集成路径

LLM 评估的工程化存在公认的成熟度阶梯：**L0** 人工目测、**L1** 基础确定性断言（精确匹配、正则、格式校验）、**L2** LLM-as-a-Judge 进 CI（自动打分 + 通过/失败门禁）、**L3** 完整评估流水线（多指标打分、回归对比、成本追踪、安全检查、边界样例人工复核）；2026 年多数团队仍停留在 L0–L1，先进团队通过 L2–L3 在用户之前拦截回归（[Neura MD Directory](https://www.neura.market/directories/md-directory/evals-md-ai-howto-08-evaluation-benchmarking-monv69ax)）。本体系的落地建议按阶梯推进：第一周先把 P-04/P-06/P-09 的确定性通道接入 CI（零模型成本，收益即现）；第二周接入 P-11 评审官（L2）；第四周建立金标准集与回归对比（L3）。

CI 集成参考拓扑：PR 触发 → 确定性通道（typecheck/lint/test/build/audit/axe/Lighthouse）→ 语义通道（P-11 对变更模块打分）→ 门禁判定 → 失败回写 PR 评论（含缺陷清单）→ 通过后合并并沉淀。工具选型上，promptfoo 适合 YAML 声明式的提示词回归测试与红队扫描（50+ 漏洞类型，含提示注入与越狱），可直接嵌入 GitHub Actions 在提示词变更时阻断回归（[AppSecSanta](https://appsecsanta.com/promptfoo)）；DeepEval 提供 pytest 风格的 LLM 断言；axe-core 与 Lighthouse CI 承接 P-08 的自动化部分。评估纪律上守住三条底线：**训练/评估数据不混用**、**每次提示词变更必须重跑基线评分**（无基线的新提示词得分没有意义）、**保留封印测试集**防止过拟合（[FutureAGI](https://futureagi.com/blog/ai-llm-prompts-model-evaluation-2025/)）。

### 6.2 评审官校准与偏差缓解清单

LLM 评审官不是装上就可信的，其偏差已被系统量化：位置偏差（偏袒先出现或后出现的选项）、冗长偏差（长答案系统性高估）、自偏好偏差（同族模型互评虚高）、评分格式偏差（rubric 顺序与计分符号影响精度）（[arXiv:2506.22316](https://arxiv.org/html/2506.22316v2)，[Confident AI](https://www.confident-ai.com/blog/why-llm-as-a-judge-is-the-best-llm-evaluation-method)）。本体系的缓解机制内置于 P-11 模板与运营流程两处：

| 偏差 | 模板内缓解（P-11） | 运营缓解（流程） |
| --- | --- | --- |
| 自偏好 | 强制异族评审约束 | 评审官与生成者模型族登记在案 |
| 冗长 | rubric 明示「不以长度论优劣」 | 金标准集按长度分层检验相关性 |
| 位置 | 单维度独立评分（不并排比较） | 必要时双评审官交叉（交换顺序取一致结论） |
| 评分漂移 | 等级行为化定义 + 先引用后裁决 | 200 条人工标注金标准集，上线时与每月校准，Cohen's kappa 低于阈值即告警（[FutureAGI](https://futureagi.com/blog/llm-as-a-judge-best-practices-2026/)） |
| 成本失控 | 单证据引用 ≤ 3 条 | 抽样评审（5–20% 流量）+ 评审成本独立记账 |

校准是信任的地基：没有金标准集与月度校准，评审分数流就是在靠信仰运行——一旦模型供应商静默更新，分数漂移将无声发生（[FutureAGI](https://futureagi.com/blog/llm-as-a-judge-best-practices-2026/)）。

### 6.3 指标面板与验收报告

闭环运行期间，P-00 主控官维护以下指标面板（与追踪文件同步更新）：

| 指标 | 计算方式 | 健康信号 |
| --- | --- | --- |
| 测试执行进度 | 已执行 / 计划（%） | 按计划推进 |
| 通过率 | 通过 / 已执行（%） | ≥ 80% 且趋势上行 |
| 缺陷分布 | 去重后 P0/P1/P2 数量 | P0=0，P1 ≤ 5 |
| 一次通过率 | 首轮验收即全绿的任务占比 | 趋势上行（提示词在变好） |
| 修复往返轮次 | 平均修复轮次 / 任务 | ≤ 1.5 |
| 评审官置信度 | overall_confidence 均值 | ≥ 0.8，低置信占比 < 10% |
| 提示词回归分 | 金标准集得分 vs 基线 | 无回退 |

报告节奏沿用 QA 惯例：每日摘要（已执行数、通过率、新提缺陷、阻塞项、次日计划）下班前产出；每周报告对照基线评估门禁与趋势。外包或跨团队交接时，追踪文件、缺陷清单、金标准集与提示词库四件齐交，接手可立即续跑。

### 6.4 YYC³ 生态落地示例：99 仓库矩阵的分层验收

以你上传的 YYC³ Cube Hub（YYC-Cube / YanYuCloudCube 双组织 99 个仓库的统一矩阵操作中心，聚合 13 个核心 TypeScript 包与 8 位 AI Family 智能体，覆盖核心引擎、UI 组件、三层动效与 MCP 协议的 npm 包群）为例，推荐三层落地：

| 层 | 范围 | 验收策略 | 提示词配置 |
| --- | --- | --- | --- |
| **包层**（13 个核心 TS 包 / npm 包群） | packages/* | 最严门禁：P-04/P-06/P-09 全量 + P-07 供应链清单；对外 API 变更走 P-02 | 金标准集按包各建一份；catalog 统一版本 |
| **应用层**（各站点仓库，如 ai-call.yyc3.vip 等） | apps 级仓库 | 标准门禁 + P-03/P-05/P-08 按路由抽样 | 复用包层 rubric；Hub 登记各仓库最近验收分 |
| **Hub 层**（YYC-CUBE-HUB 本身） | 单页操作中心 | 标准门禁；其「进度追踪/数据导入导出」功能可作为追踪文件的可视化宿主 | 把 ACCEPTANCE-TRACKING 数据接入 Hub 矩阵视图 |

矩阵式管理的关键是**外环的跨仓库共享**：任一仓库沉淀的判例与提示词改进经评审后同步到组织级提示词库，其余 98 个仓库下一轮规约即继承改进——这正是双环模型在多仓库生态中复利的部分。

---

## 7. 风险、边界与人因红线

**评审官不是神谕。** LLM-as-a-Judge 的对人一致率约 80%，剩余误差在规模化时会放大为成千上万的误判（[Openlayer](https://www.openlayer.com/blog/llm-as-judge-evaluation-guide)）。因此本体系把「人类门禁」设为宪法级组件：P0 处置、连续修复失败、低置信裁决三类情况必须人工裁定；金标准集与月度校准不是可选项而是信任的运维成本。

**基准分数不是验收标准。** SWE-bench Verified 已于 2026 年 2 月被 OpenAI 宣布退役——饱和与污染使其不再区分前沿能力，审计发现 59.4% 的抽测样本存在缺陷；厂商分数还存在分布内/分布外 23 个百分点的落差（[The Model Gap](https://themodelgap.com/benchmarks/swe-bench-verified)，[MDPI](https://www.mdpi.com/1999-5903/18/6/326)）。长时程演进任务上的崩塌更明显：GPT-5 从孤立修复的 65% 跌至 SWE-EVO 演进任务的 21%，任务分解（把两天重构拆成 15–20 个良定义 AI 任务）是决定 Agent 成败的前置工作（[AIctrl](https://aictrl.dev/blog/swe-evo-analysis)）。这意味着本体系的质量门禁只能建立在**你仓库自己的金标准集**上，任何外部榜单都不能替代。

**感知不能替代度量。** METR 的 39 个百分点感知鸿沟是对管理层最直接的警告：凡以开发者自评提效为依据的 AI 投入决策都站不住脚（[SoftwareSeni](https://www.softwareseni.com/what-the-research-actually-shows-about-ai-coding-assistant-productivity/)）。闭环体系的价值恰在于此——它不追求让 AI「感觉更快」，而是让每次交付**可证伪地更可靠**。

---

## 附录 A：提示词版本管理规范

提示词是生产工件，按代码同等标准管理。**版本号**：语义化（主版本=判定口径变更，次版本=新增维度/检查项，修订=措辞与示例优化）。**变更流程**：任何修改先跑金标准集回归，得分不回退方可合入；变更记录写入提示词头部注释（版本、日期、改动、回归分）。**分发**：组织级模板存于提示词库仓库，各项目通过 AGENTS.md 引用版本号锁定；升级由使用方显式触发，杜绝静默漂移。**归档**：通过门禁的判例（输入、裁决、证据）定期回灌金标准集，每季度轮换汰旧。

## 附录 B：12 维验收速查表

| 维度　　　 | 一句话通过标准　　　　　　　　　　　　　　　　　　　　　　 | 模板 |
| ------------| ------------------------------------------------------------| ------|
| 需求　　　 | 每条 AC 可测试、有编号、可回链测试用例　　　　　　　　　　 | P-01 |
| 架构　　　 | RSC 边界正确、无循环依赖、分层清晰　　　　　　　　　　　　 | P-02 |
| 组件　　　 | 复用优先、Props 契约完整、四态齐备　　　　　　　　　　　　 | P-03 |
| 类型规范　 | tsc/eslint 零错误零警告、零 any　　　　　　　　　　　　　　| P-04 |
| 服务端　　 | 请求 API 全异步、缓存显式且有失效策略、Action 有校验有鉴权 | P-05 |
| 测试　　　 | AAA 合规、AC 全覆盖、通过率/覆盖率过门禁　　　　　　　　　 | P-06 |
| 安全　　　 | OWASP 双清单 ≥ 90% 缓解、零 P0　　　　　　　　　　　　　　 | P-07 |
| 性能/a11y　| CWV 预算达标、axe wcag22aa 零违例　　　　　　　　　　　　　| P-08 |
| 构建供应链 | 可复现构建、依赖白名单与年龄策略齐备　　　　　　　　　　　 | P-09 |
| 文档　　　 | 新成员 30 分钟跑通、AGENTS.md 与现状一致　　　　　　　　　 | P-10 |
| 裁决　　　 | 证据先行、单维度、置信度达标　　　　　　　　　　　　　　　 | P-11 |
| 修复　　　 | 最小变更、前后证据、不碰断言　　　　　　　　　　　　　　　 | P-12 |

## 附录 C：术语表

**EARS**：Easy Approach to Requirements Syntax，用 WHEN/IF/WHILE + THE SYSTEM SHALL 句式书写无歧义需求的方法。**金标准集（Gold Set）**：人工标注的权威评估样本集，用于校准评审官。**LLM-as-a-Judge**：以 LLM 按 rubric 对产出打分的评估范式。**质量门禁（Quality Gate）**：一组全绿方可交付的量化阈值。**S-G-A-R-A**：本体系的五阶段双环模型（规约-生成-验收-修复-沉淀）。**Slopsquatting**：抢注 AI 幻觉包名进行投毒的供应链攻击。**表面可信（False Fluency）**：AI 代码看似专业正确实则暗藏缺陷的现象。**唯一真实来源**：规格/用例文档为权威、追踪文件只记状态，二者不得互为副本。
