/// Webview 页面模板（纯函数，便于脱离 VSCode 做单元测试）
/// CSP 按 docs/UI-UX设计规范.md 6.12：只允许插件自有资源（cspSource），
/// 禁 eval、禁远程脚本；'unsafe-inline' 仅 style（C++ 输出的表格对齐内联 style 需要）。
import { createHash } from 'crypto';

export interface PageAssets {
    scriptUri: string;
    cssUri: string;
    cspSource: string;
    initialHtml: string;
    version: string;
}

export function getNonce(): string {
    return createHash('sha256').update(String(Date.now()) + String(Math.random())).digest('hex').slice(0, 32);
}

export function renderPage(a: PageAssets): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${a.cspSource} data:; style-src ${a.cspSource} 'unsafe-inline'; script-src ${a.cspSource}; font-src ${a.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${a.cssUri}">
<title>CoveMD Preview</title>
</head>
<body>
<div id="app">
<aside id="outline" hidden aria-label="文档大纲"><div class="outline-title">大纲</div><nav id="outline-nav"></nav></aside>
<main id="content" class="markdown-body">${a.initialHtml}</main>
</div>
<script nonce="${nonce}" src="${a.scriptUri}"></script>
</body>
</html>`;
}
