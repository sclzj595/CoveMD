# CoveMD Reader

**Structure-aware Markdown Reader for VSCode**（结构感知 Markdown 阅读器），由自研 C++ 解析引擎驱动。

不是又一个"Markdown → HTML"渲染器——CoveMD 理解你的文档结构，并把这种理解转化成更好的阅读、导航体验。

## 特性

### Smart Outline 与预览双向联动
预览面板内置大纲侧栏：树状缩进显示文档标题层级，点击跳转、当前章节自动高亮，与 VSCode 主题无缝融合。

### 行级双向滚动同步
编辑器与预览在**任意位置**（不只是标题）双向对齐：滚编辑器预览跟随，滚预览编辑器跟随，航点插值 + 回声抑制保证平滑无振荡。

### Callout 提示块
GitHub 风格 `> [!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`，支持 `-` 折叠与自定义标题，渲染为原生 `<details>`（键盘可达）。

### 现代化阅读排版
跟随 VSCode 亮/暗主题自动切换；单强调色设计体系；代码块复制按钮与语言标签；斑马纹表格；窄面板自适应（大纲自动隐藏）。

### 自研 C++ 解析内核
内置 Windows x64 原生解析模块（C++17 / Node-API），无需任何外部依赖。解析不阻塞 VSCode 主线程。

## 使用

打开 Markdown 文件后：

- 快捷键 `Ctrl+Alt+V` 打开预览
- 命令面板：`CoveMD: 打开预览`

## 扩展设置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `covemd.parser` | `maddy` | 解析核心：`maddy` 或 `simple`（自研 fallback） |
| `covemd.outline` | `true` | 启用 Smart Outline 大纲侧栏（窄面板自动隐藏） |

## 路线图

- [ ] Document Statistics（字数 / 阅读时长 / 任务完成度 / 代码语言分布）
- [ ] Section Navigation（章节导航 / 面包屑 / 专注阅读模式）
- [ ] Document Diagnostics（标题层级跳级 / 空章节 / 重复标题检测）
- [ ] 多平台原生二进制（Linux / macOS）
- [ ] 增量解析

## 已知限制

- 当前内置原生模块仅覆盖 Windows x64（其他平台请等待后续版本）
- 不做 Mermaid / 数学公式 / PDF 导出——CoveMD 专注做"阅读器"而非"文档工具箱"

## 许可

[MIT](./LICENSE)
