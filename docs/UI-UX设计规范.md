# CoveMD UI/UX 设计规范（渲染样式规范）

> 适用范围：CoveMD VSCode 插件 Webview 预览面板中**渲染后的 Markdown 视觉样式**
> 版本：v0.2（新增与 cppCore 解析输出的对齐规范）｜ 日期：2026-10-04 ｜ 关联文档：[需求文档all.md](./需求文档all.md)
> 设计判读：阅读型界面（editorial reading surface），克制编辑排版语言，参考 GitHub Primer / 现代 Bootstrap 排版体系
> 拨盘设定：DESIGN_VARIANCE 3 ｜ MOTION_INTENSITY 2 ｜ VISUAL_DENSITY 4

---

## 1. 设计原则

1. **阅读优先**：预览面板是阅读面，一切样式服务于长时间阅读舒适度，不做装饰性设计。
2. **跟随宿主主题**：预览必须与 VSCode 亮/暗主题无缝融合，禁止出现与编辑器割裂的独立配色。
3. **单强调色锁**：全面板只允许一个强调色，出现在链接、引用边框、任务列表勾选等语义位置。
4. **一致性锁**：圆角、间距、字号各自只有一套刻度，同类元素全文档统一。
5. **无 AI 味**：禁用霓虹发光、渐变标题、玻璃拟态、纯黑纯白等廉价视觉手法（见第 9 节负面清单）。

---

## 2. 主题与令牌体系

### 2.1 策略：VSCode 主题变量优先

Webview 中优先消费 VSCode 注入的 `--vscode-*` CSS 变量，保证与宿主主题天然同步；自定义令牌仅作补充与兜底（便于脱离 VSCode 做浏览器调试）。

```css
:root {
  /* 1. 消费 VSCode 宿主变量（首选） */
  --cv-bg:          var(--vscode-editor-background, #fbfbfc);
  --cv-fg:          var(--vscode-editor-foreground, #1f2328);
  --cv-muted:       var(--vscode-descriptionForeground, #59636e);
  --cv-border:      var(--vscode-panel-border, #d1d9e0);
  --cv-accent:      var(--vscode-focusBorder, #2f6fde);

  /* 2. 表面与代码（自补足） */
  --cv-surface:     var(--cv-code-bg, #f6f8fa);      /* 代码块/表头底色 */
  --cv-code-text:   #24292f;
  --cv-quote-bg:    color-mix(in srgb, var(--cv-accent) 4%, transparent);
}
```

### 2.2 明暗双模规则

- 亮色底 `#fbfbfc`（近白非纯白），暗色底 `#14171c`（近黑非纯黑），禁止 `#ffffff` / `#000000`。
- 暗色模式下不简单反色：边框改为低透明白（`rgba(255,255,255,.12)`），强调色提亮一档（`#6ea8ff`），保证 WCAG AA。
- 阴影着色跟随背景色相，亮色用 `rgba(31,35,40,.08)`，暗色用 `rgba(0,0,0,.4)`，禁止纯黑阴影。
- 两种模式都必须人工验收（skill 硬性要求：只看过一种模式不许交付）。

### 2.3 强调色（唯一）

| 模式 | 色值 | 用途 |
|------|------|------|
| 亮色 | `#2f6fde` | 链接、引用左边框、任务勾选、表格选中态 |
| 暗色 | `#6ea8ff` | 同上 |

饱和度 < 80%，禁止紫色渐变、霓虹发光。语义色仅限代码高亮色板使用（见 4.3）。

---

## 3. 字体系统

### 3.1 字体栈

```css
/* 正文（含 CJK） */
--cv-font-sans: -apple-system, "Segoe UI", "PingFang SC",
                "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
/* 代码 */
--cv-font-mono: var(--vscode-editor-font-family, "JetBrains Mono",
                Consolas, "Courier New", monospace);
```

- 禁止引入外部字体文件（Webview 环境体积与离线约束），跟随系统栈。
- 全文档同一 sans 栈，强调只用**同字族的加粗/斜体**，禁止混入衬线体点缀。

### 3.2 字号阶梯（基准 15px，1.22 模数）

| 元素 | 字号 | 行高 | 字重 | 附加 |
|------|------|------|------|------|
| 正文 body | 15px | 1.75（CJK 需宽松） | 400 | 段间距 12px |
| h1 | 26px | 1.3 | 700 | 下边框 1px，底部留白 16px |
| h2 | 21px | 1.35 | 700 | 下边框 1px，上边距 32px |
| h3 | 18px | 1.4 | 600 | 上边距 24px |
| h4 | 16px | 1.5 | 600 | |
| h5 / h6 | 15px | 1.5 | 600 / 500 | h6 用 `--cv-muted` |
| 行内代码 | 0.875em | 1.6 | 400 | |
| 表格/脚注 | 14px | 1.6 | 400 | |

- 标题层级靠**字重 + 字号 + 颜色**三通道表达，h1/h2 加 1px 分隔下边框（GitHub 式），其余不加。
- 标题锚点悬停显示 `#` 链接符号，颜色 `--cv-muted`。

### 3.3 行宽与响应式

- Webview 宽度自适应面板；面板 > 900px 时正文限宽 `max-width: 860px; margin-inline: auto`（约 55-60 CJK 字符/行）。
- 窄面板（侧边预览 < 500px）下：字号整体降 1px，表格与代码块横向滚动，标题字距收紧。
- 断点使用容器查询（`@container`）而非视口媒体查询，因为 Webview 宽度跟随面板拖拽而非窗口。

---

## 4. 色彩与对比度

### 4.1 中性色（亮色模式参考值，暗色取反相应灰阶）

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--cv-fg` | `#1f2328` | 正文 |
| `--cv-muted` | `#59636e` | 脚注、题注、h6、表格次要文字 |
| `--cv-border` | `#d1d9e0` | hairline 分隔、表格边框 |
| `--cv-surface` | `#f6f8fa` | 代码块、表头、行内代码底 |

### 4.2 对比度硬指标（WCAG）

- 正文 / 标题：≥ 7:1（AAA）
- 次要文字 `--cv-muted`：≥ 4.5:1（AA）
- 代码高亮各语法色：≥ 4.5:1 对其底色
- 链接对正文底：≥ 4.5:1，且不单靠颜色区分（默认带下划线或悬停下划线）

### 4.3 代码高亮色板

代码块内语法高亮使用固定双色板（亮/暗各一套），来源对齐 VSCode 内置 Light+/Dark+ 主题观感，关键词/字符串/注释/数字四类语义色对比全部过 AA。注释色在亮暗模式分别为 `#6a737d` / `#8b949e`（斜体）。

---

## 5. 形状与间距体系

### 5.1 圆角一致性锁（一套刻度，文档内到处一致）

| 元素 | 圆角 |
|------|------|
| 代码块、表格容器、图片卡片 | 8px |
| 行内代码 | 4px |
| 引用块 | 0（直角，靠左边框表达） |
| 任务列表勾选框 | 4px |

### 5.2 垂直节奏

- 块级间距基准 16px，节间距（h2 前）32px，形成 8px 网格。
- 相邻同类块（连续列表项、连续段落）间距减半，靠密度区分列表与散文。

---

## 6. 元素级样式规范（核心章节）

### 6.1 标题 H1-H6
见 3.2 阶梯表。H1 全文档唯一时居左不加装饰；H2 起带锚点。

### 6.2 段落与行内元素
- 段落 `margin: 0 0 12px`，禁首行缩进。
- **加粗** 600；**斜体**正常倾斜；**删除线** `--cv-muted` 色。
- **链接**：强调色 + 下划线（`text-underline-offset: 3px`），悬停加深一档；外链不加图标（反 AI 味）。

### 6.3 行内代码
```css
code { background: var(--cv-surface); border: 1px solid var(--cv-border);
       border-radius: 4px; padding: 2px 6px; font-size: 0.875em; }
```

### 6.4 代码块（重点元素）
```css
pre { background: var(--cv-surface); border: 1px solid var(--cv-border);
      border-radius: 8px; padding: 16px; overflow-x: auto;
      line-height: 1.6; font-size: 13.5px; }
```
- 右上角**复制按钮**：默认 40% 透明度，悬停 100%，点击后 1.5s 内反馈"已复制"。
- 超宽代码横向滚动，不换行（`white-space: pre`），滚动条细样式。
- 语言标签：仅当代码块声明语言时，右下角 11px `--cv-muted` mono 小字，不加彩色徽章。

### 6.5 引用块
```css
blockquote { border-left: 3px solid var(--cv-accent);
             background: var(--cv-quote-bg);
             padding: 8px 16px; color: var(--cv-muted); border-radius: 0; }
```
- 嵌套引用每层缩进 16px，边框透明度递减 20%，最多 3 层。

### 6.6 列表
- 无序：`list-style: disc`，二级 `circle`，三级 `square`，之后不再降级。
- 有序：数字 + `.`，序号用 `--cv-muted`。
- 列表项行高 1.7，项间距 4px，嵌套缩进 24px。
- **任务列表**：原生 checkbox 重绘为 16px 圆角方框，勾选后文字 `--cv-muted` + 删除线，勾选框填充强调色。

### 6.7 表格
```css
table { border-collapse: separate; border-spacing: 0;
        border: 1px solid var(--cv-border); border-radius: 8px;
        overflow: hidden; width: 100%; font-size: 14px; }
thead { background: var(--cv-surface); }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--cv-border); }
tbody tr:nth-child(even) { background: color-mix(in srgb, var(--cv-surface) 50%, transparent); }
```
- 斑马纹 + 表头底色，容器圆角裁切（外圆内直）。
- 对齐遵循 Markdown 源声明（`---:` 右对齐）；数字列默认右对齐。
- 超宽表横向滚动，首列可 `position: sticky` 吸附（P1 增强）。

### 6.8 图片
- `max-width: 100%; border-radius: 8px; border: 1px solid var(--cv-border)`。
- 有 alt 时渲染为 figure 题注：12px `--cv-muted` 居中。
- 加载失败显示占位框（灰底 + 损坏图标 + alt 文本），不允许破图图标裸奔。

### 6.9 分割线
`hr { border: 0; border-top: 1px solid var(--cv-border); margin: 32px 0; }`

### 6.10 脚注
脚注区块顶部 1px 分隔线，上标序号可点击跳转，返回箭头 `↩`（文本符号，不用图标库）。

### 6.11 与 cppCore 解析输出的对齐（v0.2 新增，CSS 编写的硬约束）

cppCore（`covemd::markdown_to_html`）输出的 body-only HTML 存在**双实现语义差异**，样式表必须同时兼容，不得假设单一输出形态：

| 输出特征 | maddy（默认） | simple（自研） | CSS 对齐要求 |
|----------|--------------|----------------|--------------|
| 斜体 | `<i>` | `<em>` | 选择器必须覆盖 `i, em` |
| 删除线 | `<s>` | `<del>` | 选择器必须覆盖 `s, del` |
| 引用块多行 | 合并为单个 `<blockquote><p>`，行间以双空格分隔 | 拆分为多个相邻 `<blockquote>` | 相邻 blockquote 间距 ≤ 8px，视觉上允许贴近；不做折叠 |
| 表格对齐 | 内联 `style="text-align:..."` | 内联 `style="text-align:..."` | 一致，无需处理 |
| 标题锚点 | `<h1 id="...">`（自带 id） | `<h1 id="...">`（自带 id） | 锚点悬停样式直接基于 `h1-h6[id]` 实现 |
| 代码块 | `<pre><code class="language-xxx">` 首尾**含换行** | 同左（无首尾换行） | `pre code` 用 `display:block`，CSS 侧不依赖换行；语言标签取 class 解析 |
| 任务列表 | 支持（`<input type="checkbox">`，来自 checklistparser） | 支持（原生 `<input type="checkbox">`） | CSS 直接重绘勾选框（v0.2 实测更正：maddy 实际支持，此前记录有误） |
| 水平线 | `<hr/>` 自闭合 | `<hr>` | 选择器无需区分 |
| 内联 HTML | **不转义，原样直通** | 转义（`&lt;` 等） | 安全约束见 6.12 |

### 6.12 安全约束（v0.2 新增，M3 实现前置条件）

- maddy 不做内联 HTML 转义，`<script>`、`<iframe>` 等会直通输出——**Webview 必须配置严格 CSP**：
  `default-src 'none'; style-src {extensionUri} 'unsafe-inline'; script-src {extensionUri}; img-src * data:;`
- 仅从插件自身资源（`extensionUri`）加载脚本与样式，禁止 `eval`、禁止远程脚本。
- 链接点击一律经 Extension 侧 `vscode.open` 打开（`postMessage` 通道），Webview 内不直接 `window.open`。

### 6.13 Callout 提示块（v0.3 新增，M4 P1-2）

语法：`> [!TYPE]`（可选 `+`/- 控制折叠），TYPE ∈ NOTE/TIP/IMPORTANT/WARNING/CAUTION。

```css
.callout { border: 1px solid var(--cv-border); border-left: 3px solid var(--callout-c);
           border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; background: var(--cv-surface); }
.callout-title { font-weight: 600; font-size: 13px; color: var(--callout-c);
                 text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 4px; }
```

| TYPE | 亮色 --callout-c | 语义 |
|------|-----------------|------|
| NOTE | `#2f6fde`（=强调色） | 补充信息 |
| TIP | `#1a7f4b` | 技巧建议 |
| IMPORTANT | `#6f42c1` | 关键要点 |
| WARNING | `#9a6700` | 注意事项 |
| CAUTION | `#cf222e` | 危险操作 |

- **单强调色豁免**：Callout 五色属功能语义色（同代码高亮色板待遇），但正文渲染区其他位置仍禁止引入彩色；暗色模式五色各提亮一档保 WCAG AA。
- 底色一律用中性 `--cv-surface`，**禁止按类型染色背景**（克制，观感靠左边框 + 标题色区分）。
- 标题符号用纯文本/内联 SVG 单色图标，禁止 emoji。
- 折叠态（`[!NOTE]-`）：标题行右侧 `▸/▾` 文本符号，详情 `display: none`。

---

## 7. 交互与动效（MOTION_INTENSITY: 2，极克制）

- 唯一允许的动效：悬停/焦点过渡 `transition: 150ms ease`，作用于颜色、边框、透明度。
- **不引入入场动画、滚动视差、代码块打字机效果**。
- `prefers-reduced-motion: reduce` 时移除全部 transition。
- 焦点可达性：所有可交互元素（链接、复制按钮、任务框）有 `:focus-visible` 2px 强调色外圈。

---

## 8. 状态设计

| 状态 | 表现 |
|------|------|
| 解析中 | 首帧骨架屏：3 条灰条模拟标题/段落占位，禁用旋转 spinner |
| 空 state | 面板居中一段 `--cv-muted` 引导文案："打开或编辑 Markdown 文件以预览" |
| 解析失败 | 顶部内联错误条（浅红底 + 错误信息），不弹 toast |
| 大文档 | > 1MB 时提示"已启用分块渲染"，不静默卡顿 |

---

## 9. 负面清单（反 AI 味，逐项禁止）

| 禁止项 | 说明 |
|--------|------|
| 霓虹发光 | 代码块、标题禁止 `box-shadow` 光晕 |
| 渐变标题 / 渐变文字 | 任何位置禁止 |
| 玻璃拟态 | 预览面板禁用 `backdrop-filter` 装饰 |
| 纯黑 / 纯白 | `#000` `#fff` 不得作为背景或文字色 |
| 紫色系默认 | 强调色禁用 AI 紫，除非用户明确指定 |
| 装饰性状态点 | 列表、标题前禁止彩色圆点装饰（任务列表勾选框除外，其为功能件） |
| 混用灰阶色温 | 同一文档内不混用暖灰与冷灰 |
| 多强调色 | 除代码高亮色板外，彩色只允许出现强调色一个 |
| 手绘装饰 SVG / emoji 图标 | 元素样式一律纯 CSS 表达 |
| 圆角混搭 | 8px/4px/0 三档之外不得出现其他圆角值 |

---

## 10. Element 组件风格路线的适配说明（P2）

若采用 PRD 中"Element 风格组件化渲染"路线，映射规则：

- Element 令牌对齐本规范：`--el-color-primary` → `--cv-accent`；`--el-border-color` → `--cv-border`；`--el-fill-color-light` → `--cv-surface`。
- **只取 Element 的令牌与排版密度，不引入其组件 DOM**：预览渲染的是纯 HTML，Element 以 CSS 变量层参与，禁止为表格/按钮塞入 `el-` 组件标签。
- 若未来做插件设置面板（非 Markdown 渲染区），才允许使用 Element Plus 组件，两个面（渲染区 / 设置区）视觉令牌必须同源。

---

## 11. 验收清单

- [ ] 亮 / 暗两种 VSCode 主题下逐元素人工过检
- [ ] 正文与次要文字对比度达 4.5:1 以上（取色器实测）
- [ ] 全文档仅一个强调色，圆角仅三档（8/4/0）
- [ ] 万字长文渲染无布局抖动，表格与代码块超宽时横向滚动
- [ ] 窄面板（300px 侧边预览）下不出现横向溢出的布局元素（代码/表格除外）
- [ ] `prefers-reduced-motion` 下无任何动效
- [ ] 第 9 节负面清单逐项为零
- [ ] 样式表同时通过 maddy 与 simple 双实现的输出快照（6.11 逐项）
- [ ] Webview CSP 配置生效，外部脚本/样式资源加载被拒绝（6.12）

---

## 12. 变更记录

| 版本 | 变更内容 |
|------|----------|
| v0.2 | 新增 6.11（与 cppCore 双解析器输出的对齐矩阵，CSS 编写硬约束）、6.12（CSP 安全约束）；验收清单同步补两项 |
| v0.1 | 初稿：令牌体系、字体阶梯、元素级样式、动效纪律、负面清单、Element 路线适配 |
