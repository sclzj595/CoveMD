# 更新日志

## 0.1.0（2026-10-05）

首发版本。

- Markdown 实时预览（自研 C++ 解析内核，Node-API 原生模块，Windows x64）
- Smart Outline 大纲侧栏：层级缩进、点击跳转、当前章节高亮
- 编辑器 ↔ 预览行级双向滚动同步（航点插值，任意位置对齐）
- Callout 提示块：NOTE / TIP / IMPORTANT / WARNING / CAUTION，支持折叠
- 代码块增强：复制按钮、语言标签
- 跟随 VSCode 亮/暗主题，单强调色阅读排版
- 双解析内核可选：maddy（默认）/ simple（自研 fallback）
- 安全加固：CSP 严格模式、行内代码 HTML 转义、脚本剥离兜底
