# CoveMD 产品需求文档（PRD）

> 项目名：**CoveMD**（Cove 取自 SoulCove，MD = Markdown）
> 副标题：**Structure-aware Markdown Reader for VSCode**（结构感知 Markdown 阅读器）
> 版本：v0.3（产品定位升级：Renderer → Reader）
> 日期：2026-10-04（v0.1/v0.2 同日迭代）

---

## 1. 项目概述

### 1.1 一句话定位

CoveMD 是一款**结构感知的 VSCode Markdown 阅读器**：基于自研 C++ AST 解析引擎（源自 SoulCove Qt 编辑器），不仅把 Markdown 渲染为 HTML，更**理解文档结构**，把结构转化为更优的阅读、导航与分析体验，最终发布到 VSCode 插件市场。

### 1.2 三层价值主张

| 层 | 内容 |
|----|------|
| 用户卖点 | **结构理解**：Smart Outline、文档统计、章节导航——"这个插件懂我的文档" |
| 技术卖点 | 自研 C++ AST 引擎（Parser/AST/Renderer 三重 ownership，语法可自主扩展） |
| 产品价值 | **长文档阅读**：面向每天阅读大型 Markdown（README/技术文档/笔记）的用户 |

### 1.3 竞争定位（重要纪律）

- **不与 Markdown Preview Enhanced 正面比功能清单**（Mermaid/Math/PDF/Pandoc 是其"文档工具箱"地盘，跟进必输）；CoveMD 走"Markdown 阅读器"细分：比谁更适合**每天阅读大型 Markdown 文档**。
- **性能不作为当前卖点**：C++ 是护城河不是宣传语；在持有规范 benchmark（同机/同文档/多规格 10KB→50MB/P50-P95/冷热启动）之前，禁止宣称"更快"。
- **不堆 Markdown 语法功能**：避免三个月后变成"另一个 MPE"。优先打通 AST → Outline → Navigation → Statistics → Reading 主链。

### 1.4 背景与动机

- SoulCove（Qt 桌面编辑器）已内置一套 C++ 手写的 Markdown 解析器（词法分析 → 语法解析 → AST → HTML 输出）。
- 将解析核心抽离为**纯 C++ 无 GUI 的独立库**，验证其可移植性：一核两宿主（Qt 编辑器 + VSCode 插件）。
- 市面预览插件多基于 JS 库（marked 等），C++ 解析核心在大文档场景性能更优，且不阻塞 JS 主线程。
- 面试价值：编译原理 + 跨语言调用（Node-API）+ 原生模块跨平台打包分发，技术话题充足。

### 1.5 目标用户

- 使用 VSCode 写 Markdown 的开发者 / 文档作者（README、博客、笔记）。
- 对预览渲染质量和美观度有要求的用户。

---

## 2. 整体架构（三层范式）

```
┌──────────────────────────────────────────────────────────┐
│                 VSCode 插件宿主（TypeScript）              │
│   Extension 层：命令注册 / onDidChangeTextDocument 监听    │
│   Webview 层：HTML 渲染预览面板，postMessage 双向通信        │
├──────────────────────────────────────────────────────────┤
│           适配层：Node-API 原生模块（薄封装）                │
│   JS字符串 ↔ std::string 互转、内存管理、编译产物 dll/so     │
├──────────────────────────────────────────────────────────┤
│        【C++ Markdown 解析核心 Core】✅ 已落地 cppCore      │
│   纯 C++17 STL、零 Qt/零 Boost/零 Node 依赖                │
│   covemd::markdown_to_html()：UTF-8 进出，body-only HTML   │
│   双实现：maddy（默认）+ simple（自研 fallback，工厂切换）   │
└──────────────────────────────────────────────────────────┘
```

- **核心原则**：业务逻辑全部在 Core；适配层只做类型转换，保持薄封装。
- **核心库现状（v0.2）**：`cppCore/` 已完成 STL 化并编译验证通过（MinGW g++ 14.2 / C++17）。
  目录结构：`include/covemd/`（公开 API）+ `src/`（适配与实现）+ `third_party/maddy/`（已打补丁）+ `demo/`（命令行验证工具）。
  旧 Qt 版源码已清理，历史在 git。

### 调用链路

```
用户编辑 Markdown → onDidChangeTextDocument (TS)
  → 调用 Node-API 原生模块
  → C++ Core: markdown_to_html() 词法+语法解析
  → HTML 字符串返回 TS
  → postMessage 推送到 Webview
  → Webview 渲染现代化预览页面
```

---

## 3. 功能需求

### 3.1 P0（MVP 必须）

| 编号 | 功能 | 说明 |
|------|------|------|
| P0-1 | Markdown 实时预览 | 监听文档变更，调用 Core 解析，Webview 实时渲染 |
| P0-2 | 基础语法解析 | 标题、列表、代码块、链接、加粗、引用等常用语法（以 Core 库实际能力为准） |
| P0-3 | 预览面板 | Webview 加载 HTML，预览命令 / 快捷键触发 |
| P0-4 | Node-API 原生模块 | TS ↔ C++ 跨语言调用封装，字符串互转、无内存泄漏 |
| P0-5 | 插件打包发布 | vsce 打包，发布到 VSCode Marketplace |

### 3.2 P1（M4 Reading Foundation——第一个差异化版本）

| 编号 | 功能 | 说明 |
|------|------|------|
| P1-1 | Smart Outline | AST 驱动的标题树侧栏：点击跳转 + 滚动时高亮当前章节（双向联动，非普通目录） |
| P1-2 | Callout 语法 | `> [!NOTE/TIP/IMPORTANT/WARNING/CAUTION]` GitHub 风格提示块（Core 侧 blockparser 扩展） |
| P1-3 | 滚动同步 | 编辑区 ↔ 预览区滚动位置联动（Outline 联动的基础设施） |
| P1-4 | 现代化渲染样式完善 | 代码高亮、富文本元素样式按 UI 规范持续打磨 |

### 3.3 P2（M5 Document Intelligence——AST 白送的能力）

| 编号 | 功能 | 说明 |
|------|------|------|
| P2-1 | NAPI 结构化输出 | `parse()` 返回 AST 摘要 JSON（headings 含 level/text/offset + statistics），NAPI 层升级为"文档模型提供方" |
| P2-2 | Document Statistics 面板 | 字数/阅读时长/标题分布/代码块与语言分布/任务完成度/图片链接计数——全部从 AST 统计 |
| P2-3 | 主题适配 | 跟随 VSCode 亮/暗主题（M3 已修 body 作用域令牌，继续深化） |

### 3.4 P3（M6 Navigation & Diagnostics——成为"阅读器"）

| 编号 | 功能 | 说明 |
|------|------|------|
| P3-1 | Section Navigation | 上一节/下一节、当前节跟踪（Section x/y）、标题面包屑 |
| P3-2 | Focus Reading Mode | 阅读进度、当前章节定位、快速跳转 |
| P3-3 | Document Diagnostics | 标题层级跳跃、重复标题、空章节、TODO 检测、文档健康度评分 |

### 3.5 明确不做（防跑偏清单）

Mermaid/Math 公式/PDF 导出/Pandoc/WYSIWYG 编辑——MPE 与 Office 系插件的地盘，投入产出比极低。仅当用户强需求验证后才考虑（Mermaid 可低成本走 Webview 侧 mermaid.js，见待定事项）。

---

## 4. 非功能需求

- **性能**：解析在 C++ 侧完成，不阻塞 VSCode JS 主线程；大文档（万字级）解析响应流畅。
- **内存安全**：Node-API 层对象及时释放，避免 V8 内存泄漏；Core 侧遵循 C++ 内存/线程安全规范。
- **跨平台**：Core 纯标准 C++ 可编译于 Windows / Linux / Mac；插件随平台携带对应原生二进制。
- **可维护性**：Core 与适配层解耦，解析器升级仅改 Core，两端宿主同步受益。

---

## 5. 渲染样式规范（P1 重点）

- 整体风格：现代化、响应式（Bootstrap 式排版网格与间距体系）。
- 排版要素：标题层级清晰、行高舒适、代码块圆角+深色主题、引用块、表格斑马纹。
- Webview 内部技术选型（二选一，实现时定）：
  - 方案 A：纯 CSS 样式表（Bootstrap 风格重写，轻量无依赖）；
  - 方案 B：引入 Element 组件风格 / Vue 组件库构建 Webview UI（视觉统一、开发快，体积较大）。

---

## 6. 里程碑与迭代路线

| 阶段 | 内容 | 退出标准 |
|------|------|----------|
| M1 核心接入 | ✅ 已完成（2026-10-04）：Qt 版 STL 化，CMake 构建，demo 冒烟通过 | md → html 输出正确 |
| M2 原生模块 | ✅ 已完成（2026-10-04）：binding 11/11 测试；**MSVC 重编修复 Electron 段错误**（MinGW 教训入档） | TS 调用通过无泄漏 |
| M3 插件 MVP | ✅ 已完成（2026-10-04）：真机预览跑通、主题跟随修复（body 作用域令牌）、真文档解析审计零缺陷 | 本地可用已验收 |
| M4 Reading Foundation | Smart Outline（AST 标题树 + 双向同步）+ Callout（Core blockparser）+ 滚动同步 + 样式完善 | 长文档阅读体验明显优于内置预览 |
| M5 Document Intelligence | NAPI 结构化输出（AST 摘要 JSON）+ Statistics 面板 | 统计数据与 AST 一致 |
| M6 Navigation & Diagnostics | Section 导航/面包屑/Focus Mode/文档健康度 | "阅读器"形态成立 |
| M7 发布与性能 | async 解析 + 规范 benchmark（10KB→50MB，P50/P95）+ vsce 多平台上架 | 带数据支撑的市场版本 |

---

## 7. 风险与应对

| 风险 | 应对 |
|------|------|
| 原生二进制跨平台分发复杂（市场不自动跨平台） | CI 按平台分别编译打包；或提供纯 JS 降级方案 |
| Node-API 内存泄漏 | 封装层统一 RAII 管理，压测长时调用 |
| 全量解析大文档卡顿 | 先全量保正确，M 后期做增量解析优化 |
| ~~Core 库尚未到位~~ **已解除** | v0.2 起 cppCore 已落地，此风险关闭 |
| maddy 不转义内联 HTML（`<script>` 直通） | Webview 必须配置严格 CSP，仅加载插件自有资源；渲染前可选 HTML 白名单过滤（M3 决策） |
| 无 benchmark 宣称"更快"将陷入被动（面试官一句"快多少"即破防） | M7 前禁用性能卖点；benchmark 规范见 1.3 |
| Callout 需改 vendored maddy（blockparser） | 沿用既有补丁纪律（已 3 处），保持最小粒度并记录 |

---

## 8. 待定事项

- [x] ~~C++ 解析核心库源码接入~~（v0.2 已完成：cppCore STL 化落地）
- [x] ~~Webview 样式方案定稿~~（v0.3 定稿：纯 CSS 令牌体系，Element 仅作 P2+ 设置面板参考）
- [x] ~~M2 同步 vs 异步~~（同步已交付；async 归入 M7）
- [ ] 插件 ID / Marketplace 发布名称与图标（displayName 已更新为 Structure-aware Markdown Reader）
- [ ] README 第一屏定稿：结构感知定位 + AST 分发图 + 截图优先，不提性能
- [ ] NAPI 结构化输出 schema 设计（headings{level,text,offset} + statistics）
- [ ] Callout 语法细节：与普通引用的边界、嵌套行为、maddy blockparser 改动方案
- [ ] ~~Mermaid~~（v0.3 关闭：列入"明确不做"，除非强需求验证）

---

## 9. 变更记录

| 版本 | 变更内容 |
|------|----------|
| v0.3 | **产品定位升级：Renderer → Structure-aware Markdown Reader**；新增三层价值主张与竞争纪律（不比 MPE 功能清单、性能暂不作卖点、不堆语法功能）；功能重排 P1=Reading Foundation（Outline/Callout/滚动同步）、P2=Document Intelligence（NAPI 结构化输出/统计面板）、P3=Navigation & Diagnostics；新增"明确不做"清单；里程碑重排 M4-M7；M1-M3 收口标记完成 |
| v0.2 | M1 完成收口：cppCore STL 化（C++17、零依赖、双解析器工厂）、vendored maddy 打 3 处补丁（quote 闭合缺陷 / 强调正则负向前瞻 / CRLF 归一化）、旧 Qt 源码清理；新增 CSP 风险项与 M2 设计决策待定项 |
| v0.1 | 头脑风暴概括稿：定位、三层架构、P0-P2 功能分级、里程碑、风险清单 |
