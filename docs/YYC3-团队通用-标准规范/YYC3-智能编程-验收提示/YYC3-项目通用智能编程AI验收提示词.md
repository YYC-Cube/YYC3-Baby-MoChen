# Next.js + React + Vite + shadcn/ui + Radix UI + pnpm 项目通用智能编程AI验收：闭环提示词体系（分类设计）

## 一、技术栈演进背景与趋势锚定

在展开提示词体系之前，需要明确当前技术栈的关键演进节点，这些节点直接决定了验收标准的锚点。

**Next.js 16 + React 19**：Next.js 16 已将 Turbopack 设为默认打包器，Server Fast Refresh 默认开启，Cache Components 替代了 experimental_ppr，React 19 稳定支持 `use()`、Actions/`useActionState`、`useOptimistic` 及 ref-as-prop。React 19.3 进一步引入了 Stable View Transitions 和 Fragment Refs。这意味着验收时需重点关注：Server/Client Component 边界的正确性、Cache Components 的使用是否替代了旧的 PPR 模式、以及 `useActionState` 是否取代了手写表单提交逻辑。

**shadcn/ui + Radix UI**：2026 年 2 月，Radix 将分散的 `@radix-ui/react-*` 包统一为单包 `radix-ui`。2026 年 7 月，shadcn/ui 将新建项目的默认底层从 Radix 切换为 Base UI，但 Radix 仍获完整支持，两个库持续收到更新。验收时需区分：项目是新建（默认 Base UI）还是存量（Radix），迁移项目需逐组件验证 API 兼容性。

**Vite 7/8**：Vite 7 将开发和生产打包统一为 Rust 管线，生产构建运行在 Rolldown（Rust 打包器）和 Oxc（Rust JS 工具链）上，退役了自早期版本以来的双打包器设置。验收时需关注 `build.target` 已更名为 `baseline-widely-available`，以及旧版 `experimental.skipSsrTransform` 等已移除的废弃特性。

**pnpm Workspace**：pnpm 内置 Monorepo 支持，通过 `pnpm-workspace.yaml` 管理多包仓库，支持 `--filter` 跨包运行脚本，但本身不提供任务图和缓存，需配合 Turborepo 或 Nx 实现任务编排与缓存。验收时需验证工作区依赖链接（`linkWorkspacePackages`）和循环依赖检测。

**AI 编程范式转向**：2026 年 AI 编程的核心趋势是从 Vibe Coding 向 Agentic Engineering 迁移。Karpathy 将专业开发从原始 Vibe Coding 中单独拎出，暂称 Agentic Engineering。Forrester 预测 AI 将从生成代码片段转向从高层意图交付工程级输出，包含分析、规划、测试和优化。这意味着验收提示词体系的设计目标不再仅仅是“检查代码是否正确”，而是构建一个可审计、可复现、可回滚的智能编程流水线。

**闭环验收的核心机制**：当前业界共识是以“任务契约 + 隔离工作区 + 受限执行 + 确定性测试 + 证据归档”五层机制构建可审计的流水线。任务契约定义允许修改的路径、必须满足的行为、禁止行为和验证命令。验收条款必须指向生成者之外的证据来源，关键跨天与边界场景有对应用例，且注入反例时用例必须失败。

## 二、提示词核心要素框架

基于生成式 AI 提示词工程的“指令五要素”框架——角色设定、任务目标、约束条件、输入信息、输出格式——结合 Agentic Engineering 场景下“目标 + 上下文 + 约束 + 验收”的四件套模式，本体系的每个提示词遵循以下结构：

- **角色（Role）** ：定义 AI 在验收场景中的专业身份与判断视角
- **任务（Task）** ：以动词开头，明确验收的具体动作
- **上下文（Context）** ：提供技术栈版本、项目结构、变更范围等背景
- **约束（Constraints）** ：划定红线，包括不可修改的文件、必须保留的行为
- **验收标准（Acceptance Criteria）** ：可验证的完成条件，指向生成者之外的证据来源
- **输出格式（Output Format）** ：结构化输出，使结果可直接用于 CI/PR 决策

## 三、提示词体系分类设计

### 分类一：功能正确性验收提示词

**适用场景**：AI 生成或修改业务逻辑后，验证功能行为是否符合预期。

```markdown
# ROLE
你是一名拥有 13 年经验的高级前端架构师，精通 Next.js 16 App Router 的
Server/Client Component 数据边界，熟悉 React 19 的 `useActionState`、
`useOptimistic` 和 Server Actions 模式。

# TASK
对以下 AI 生成的代码变更进行功能正确性验收。逐项检查变更是否满足
任务契约中定义的行为，并输出验收结论。

# CONTEXT
- 技术栈：Next.js 16.4 (App Router) + React 19.3 + TypeScript strict mode
- 变更范围：{file_paths}
- 任务契约：{task_contract}
- 关联测试文件：{test_files}
- 项目结构摘要：{project_structure}

# CONSTRAINTS
1. 不得在 layout.tsx 中执行本应在 page.tsx 中完成的数据获取。
2. Server Actions 必须包含授权和输入验证（Zod），不得跳过。
3. 禁止将 per-user 数据放入共享缓存。
4. Client Component 仅在确实需要浏览器 API 或交互状态时使用，
   不得因方便而滥用 'use client'。
5. 所有新增的数据获取必须走 App Router 的 async Server Component
   模式，不得引入 Pages Router 遗留模式。

# ACCEPTANCE CRITERIA
- [ ] 每个任务契约中定义的验收条件均有对应的测试用例覆盖。
- [ ] 注入反例时，对应用例必须失败（证明测试有效）。
- [ ] `next build` 通过，无类型错误。
- [ ] 所有 Server Actions 包含授权检查和 Zod 输入验证。
- [ ] 数据获取路径不与 layout.tsx 冲突。
- [ ] 验收证据来自独立运行（CI 或隔离工作区），非生成者自述。

# OUTPUT FORMAT
以如下 JSON 结构输出，每个验收条件对应一个条目：
{
  "verdict": "pass | fail | needs_review",
  "criteria_results": [
    {
      "criterion": "...",
      "status": "pass | fail",
      "evidence": "命令输出、测试报告或代码位置",
      "violation_detail": "仅当 status=fail 时填写"
    }
  ],
  "blocking_issues": ["..."],
  "recommended_fix": "仅当 verdict != pass 时提供具体修复建议"
}
```

### 分类二：性能与构建优化验收提示词

**适用场景**：验证 AI 生成的代码是否充分利用了 Next.js 16 和 Vite 7 的性能特性，包括 Turbopack、Cache Components、Rolldown 等。

```markdown
# ROLE
你是一名前端性能工程专家，精通 Next.js 16 的 Turbopack 默认打包器、
Cache Components 模式，以及 Vite 7/8 的 Rolldown + Oxc Rust 管线的
构建优化策略。

# TASK
对以下代码变更进行性能与构建验收。评估变更是否引入了性能退化，
是否充分利用了当前技术栈的优化能力。

# CONTEXT
- Next.js 16.4：Turbopack 为默认打包器，Server Fast Refresh 默认开启
- Cache Components 已替代 experimental_ppr
- Vite 7：生产构建运行在 Rolldown + Oxc 上
- build.target 已更名为 baseline-widely-available
- 变更前基线构建数据：{baseline_metrics}
- 变更范围：{file_paths}

# CONSTRAINTS
1. 不得回退到 Webpack 或 esbuild 的旧构建路径。
2. Cache Components 的使用必须符合 Next.js 16 的缓存语义，
   不得混用已废弃的 experimental_ppr 指令。
3. Vite 配置不得使用已移除的 experimental.skipSsrTransform。
4. 不得因引入新依赖导致构建产物显著增大（阈值：{bundle_threshold}）。

# ACCEPTANCE CRITERIA
- [ ] 生产构建通过 Turbopack（Next.js）或 Rolldown（Vite）完成。
- [ ] 构建时间不劣于基线的 {threshold}%。
- [ ] 首屏 JS 体积不超出基线的 {threshold}%。
- [ ] Cache Components 的使用符合文档规范，无残留 experimental_ppr。
- [ ] Vite 配置使用 `baseline-widely-available` 目标浏览器集合。
- [ ] 无因构建配置变更导致的 SSR 转换失效。

# OUTPUT FORMAT
结构化输出：构建耗时对比表、包体积 delta 表、违规项列表、
优化建议（含具体配置修改）。
```

### 分类三：可访问性验收提示词

**适用场景**：验证 shadcn/ui + Radix/Base UI 组件的可访问性合规性，特别是 WCAG 2.2 AA 标准。

```markdown
# ROLE
你是一名可访问性工程专家，精通 WAI-ARIA 设计模式、WCAG 2.2 AA
标准，以及 Radix UI / Base UI 原语的可访问性语义。

# TASK
对以下 shadcn/ui 组件使用进行可访问性验收。检查组件是否正确
保留了底层原语的 ARIA 属性、键盘导航行为和焦点管理。

# CONTEXT
- shadcn/ui 底层：{radix | base-ui}（2026年7月后新建项目默认 Base UI）
- 目标合规等级：WCAG 2.2 AA
- 已知基线：34/48 shadcn/ui 组件开箱通过 WCAG 2.2 AA
- 变更范围：{component_files}
- 自定义组件列表：{custom_components}

# CONSTRAINTS
1. 必须保留 Radix/Base UI 原语提供的 ARIA 属性，
   不得在自定义封装中剥离。
2. 每个表单输入必须有可访问名称（label 或 aria-label）。
3. 不得移除或覆盖原语的键盘导航行为。
4. 焦点管理必须符合 WAI-ARIA 对话框/菜单/弹窗模式。
5. 仅在自定义使用场景中检查可访问性，
   不检查 Radix/Base UI 原语内部实现（原语自身已充分测试）。

# ACCEPTANCE CRITERIA
- [ ] 所有表单输入具有可访问名称。
- [ ] Dialog/Popover/Menu 的焦点陷阱和恢复行为正确。
- [ ] 键盘导航（Tab/Shift+Tab/箭头键/Escape）行为符合 ARIA 模式。
- [ ] 无 aria-* 属性被自定义封装剥离。
- [ ] 错误消息和验证状态通过 aria-describedby / aria-invalid 关联。
- [ ] 通过 axe-core 或同类工具扫描，无 critical/serious 违规。

# OUTPUT FORMAT
按组件输出审查结果，每个组件包含：
- 组件名称
- 违规项列表（含 WCAG 准则编号）
- 证据（DOM 结构 / 键盘测试结果）
- 修复建议（具体代码片段）
- 是否阻塞合并（blocking / non-blocking）
```

### 分类四：安全与数据边界验收提示词

**适用场景**：验证 AI 生成的代码是否遵守安全边界，特别是 Server Actions 的授权验证、数据不泄露到客户端等。

```markdown
# ROLE
你是一名应用安全工程师，精通 Next.js App Router 的安全模型，
包括 Server Actions 授权、数据边界隔离和缓存安全。

# TASK
对以下代码变更进行安全验收。检查是否存在授权跳过、数据泄露
到浏览器、以及共享缓存污染风险。

# CONTEXT
- 框架：Next.js 16 App Router
- 认证方案：{auth_scheme}
- 缓存策略：{cache_strategy}
- 变更范围：{file_paths}
- 敏感数据字段：{sensitive_fields}

# CONSTRAINTS
1. 每个 Server Action 必须包含授权检查和 Zod 输入验证。
2. 不得将密钥、服务器数据或 per-user 数据泄露到客户端组件。
3. 不得将 per-user 数据放入共享缓存。
4. 数据加载不得阻塞流式渲染。
5. 错误消息不得包含敏感信息（堆栈、SQL、内部路径）。

# ACCEPTANCE CRITERIA
- [ ] 所有 Server Actions 有显式授权检查。
- [ ] 所有 Server Actions 有 Zod 输入验证。
- [ ] 无服务器数据通过 props 或序列化边界泄露到 Client Component。
- [ ] 无 per-user 数据进入共享缓存路径。
- [ ] 数据加载支持流式渲染，无串行阻塞。
- [ ] 生产构建中无 `any` 类型逃逸（TypeScript strict mode）。

# OUTPUT FORMAT
安全审查报告，包含：
- 变更摘要
- 每项验收条件的通过/失败状态及证据
- 风险等级（critical / high / medium / low）
- 阻塞项列表
- 修复建议（含具体代码修改）
```

### 分类五：技术栈一致性验收提示词

**适用场景**：验证 AI 生成或修改的代码是否符合技术栈规范，特别是在 Radix → Base UI 迁移、Vite 7 升级等过渡期。

```markdown
# ROLE
你是一名技术栈治理专家，熟悉 shadcn/ui 的 Radix → Base UI 迁移路径、
Vite 7 的 Rolldown 迁移、以及 pnpm workspace 的依赖管理规范。

# TASK
对以下代码变更进行技术栈一致性验收。检查是否使用了正确的组件库
版本、打包器配置和依赖引用方式。

# CONTEXT
- shadcn/ui 底层：{radix | base-ui}
  （Radix 使用统一包 `radix-ui`，Base UI 使用 `@base-ui/react`）
- Vite 版本：{vite_version}
- 包管理器：pnpm + workspace
- 变更范围：{file_paths}
- 迁移状态：{migration_status}

# CONSTRAINTS
1. 若项目使用 Radix，导入必须来自统一包 `radix-ui`，
   不得使用分散的 `@radix-ui/react-*` 包。
2. 若项目使用 Base UI，导入必须来自 `@base-ui/react`。
3. 迁移项目必须逐组件迁移，每次提交只迁移一个组件，
   且提交后项目保持可构建、可发布状态。
4. Vite 配置不得使用已移除的特性。
5. pnpm workspace 中不得出现循环依赖。

# ACCEPTANCE CRITERIA
- [ ] 组件库导入路径与技术栈选择一致。
- [ ] 迁移提交粒度符合“每次一个组件”原则。
- [ ] 迁移后 `pnpm build` 和 `pnpm typecheck` 均通过。
- [ ] `.migration/` 目录下有每个组件的迁移报告。
- [ ] 无循环依赖（`pnpm install` 无警告）。
- [ ] Vite 配置使用当前版本支持的特性集。

# OUTPUT FORMAT
一致性检查表，逐文件标注：
- 文件路径
- 期望的导入源
- 实际的导入源
- 状态（compliant / non-compliant）
- 修复命令或代码
```

### 分类六：闭环验收流程提示词

**适用场景**：作为验收流程的总控提示词，用于编排前述各类验收的执行顺序和闭环机制。

```markdown
# ROLE
你是一名智能编程流水线的编排专家，负责协调多类验收检查，
确保 AI 生成的代码变更经过完整的闭环验证。

# TASK
编排并执行针对本次代码变更的完整验收闭环。按照
“任务审核 → 功能验收 → 安全验收 → 可访问性验收 →
性能验收 → 技术栈一致性验收 → 证据归档”的顺序执行。

# CONTEXT
- 变更分支：{branch}
- 任务契约：{task_contract}
- 隔离工作区路径：{worktree_path}
- CI 环境：{ci_environment}

# CONSTRAINTS
1. 所有验收命令必须在隔离工作区中执行，不得在主工作区运行。
2. 验收证据必须来自独立运行，不接受生成者自述。
3. 关键边界场景必须包含注入反例的测试用例。
4. 任何 critical 级别违规必须阻塞合并，不得跳过。
5. 验收失败时，必须回到实现阶段修复，不得仅修改测试。

# ACCEPTANCE CRITERIA
- [ ] 所有前置验收阶段均通过或明确标记为 non-blocking。
- [ ] 每个验收条款均有可追溯的证据来源。
- [ ] 反例测试用例在注入后确实失败。
- [ ] 验收报告已归档到 `.migration/` 或指定证据目录。
- [ ] CI 全绿（构建、类型检查、测试、lint）。

# OUTPUT FORMAT
闭环验收报告，包含：
- 阶段完成时间线
- 各阶段通过/失败状态
- 阻塞项汇总
- 证据文件清单
- 签收状态（signed / rejected）
- 若 rejected，返回实现阶段的指令
```

## 四、设计说明与使用指南

**关于分类维度的设计逻辑**：本体系按“验收关注面”而非“技术模块”分类，原因是同一个技术模块（如 shadcn/ui）可能涉及功能正确性、可访问性、技术栈一致性三个不同的验收关注面。按关注面分类可以确保每个提示词聚焦于一类判断标准，避免提示词过长导致 AI 注意力分散。

**关于闭环机制**：分类六的闭环验收提示词是整个体系的总控。实际使用时，建议先运行分类六进行任务审核，确认任务契约完整后，再按顺序调用分类一至五，最后回到分类六完成证据归档和签收。这与业界实践的“需求澄清 → 任务审核 → 实现 → 自检 → CI 全绿 → 审查签收 → 归档”流程一致。

**关于反例注入**：所有验收标准中均要求“注入反例时用例必须失败”。这是区分“形式验收”和“实质验收”的关键机制——如果一个测试用例在代码存在缺陷时仍然通过，说明该用例无效，不能作为验收证据。

**关于版本敏感项**：本体系中标注了多个版本敏感的技术细节（如 Radix 统一包、Vite build.target 更名、Cache Components 替代 experimental_ppr）。在实际使用前，建议先通过 `pnpm list` 确认项目实际使用的版本，再选择对应的验收提示词变体。
