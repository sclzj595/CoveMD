'use strict';
// 页面模板纯函数测试（脱离 VSCode 运行）：CSP 完整性 + 资源注入 + 绑定集成
const assert = require('assert');
const path = require('path');

// TS 编译产物 page.js（CommonJS）
const { renderPage, getNonce } = require(path.join(__dirname, '..', 'out', 'page.js'));
// 绑定集成：真实解析器输出作为首帧内容
const covemd = require(path.join(__dirname, '..', '..', 'binding', 'index.js'));

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  PASS ' + name); }
  catch (e) { console.error('  FAIL ' + name + ' -> ' + e.message); process.exitCode = 1; }
}

const ASSETS = {
  scriptUri: 'https://mock.csp_src/ext/media/main.js',
  cssUri: 'https://mock.csp_src/ext/media/preview.css',
  cspSource: 'https://*.vscode-cdn.net',
  initialHtml: covemd.parse('# 标题\n\n正文 **加粗**\n'),
  version: '0.1.0',
};

check('page contains CSP meta', () => {
  const html = renderPage(ASSETS);
  assert.ok(html.includes('http-equiv="Content-Security-Policy"'), html.slice(0, 200));
});
check('CSP: default-src none + cspSource only', () => {
  const html = renderPage(ASSETS);
  assert.ok(html.includes("default-src 'none'"), html);
  // script-src 指令白名单必须恰好等于 cspSource（无 unsafe-inline、无其他远程源）
  const m = html.match(/script-src ([^;]*);/);
  assert.ok(m, '存在 script-src 指令');
  assert.deepStrictEqual(m[1].trim().split(/\s+/), [ASSETS.cspSource], m[1]);
});
check('script/css linked with nonce isolation', () => {
  const html = renderPage(ASSETS);
  assert.ok(html.includes(`src="${ASSETS.scriptUri}"`), html);
  assert.ok(html.includes(`href="${ASSETS.cssUri}"`), html);
  const nonce = html.match(/nonce="([0-9a-f]+)"/);
  assert.ok(nonce, 'script 必须带 nonce');
});
check('nonce is random per render', () => {
  assert.notStrictEqual(
    renderPage(ASSETS).match(/nonce="([0-9a-f]+)"/)[1],
    renderPage(ASSETS).match(/nonce="([0-9a-f]+)"/)[1]
  );
});
check('initialHtml embedded (real C++ parse)', () => {
  const html = renderPage(ASSETS);
  assert.ok(html.includes('<h1'), html);
  assert.ok(html.includes('标题'), html);
  assert.ok(html.includes('<strong>加粗</strong>'), html);
});
check('parse version exposed', () => {
  assert.ok(/^\d+\.\d+\.\d+/.test(covemd.version), covemd.version);
});
check('getNonce format', () => {
  assert.ok(/^[0-9a-f]{32}$/.test(getNonce()), getNonce());
});

// ---------- M4：双栏结构 + Callout + Outline 提取 ----------
const { extractOutline, headingAtLine } = require(path.join(__dirname, '..', 'out', 'outline.js'));

check('page has outline aside + app flex layout', () => {
  const html = renderPage(ASSETS);
  assert.ok(html.includes('id="outline"'), html);
  assert.ok(html.includes('id="app"'), html);
  assert.ok(html.includes('id="outline-nav"'), html);
  assert.ok(html.includes('aria-label="文档大纲"'), html);
});
check('webview script sends ready handshake (outline race guard)', () => {
  const fs = require('fs');
  const js = fs.readFileSync(path.join(__dirname, '..', 'media', 'main.js'), 'utf8');
  assert.ok(js.includes("type: 'ready'"), 'main.js 必须在加载完成时上报 ready');
});
check('webview script acquires vscode api host channel', () => {
  const fs = require('fs');
  const js = fs.readFileSync(path.join(__dirname, '..', 'media', 'main.js'), 'utf8');
  assert.ok(js.includes('acquireVsCodeApi()'), '__covemdHost 必须来自 acquireVsCodeApi（否则所有 postMessage 抛错）');
  assert.ok(!/window\.__covemdHost\.postMessage/.test(js.replace(/window\.__covemdHost = acquireVsCodeApi\(\)/, '')) === false || js.indexOf('acquireVsCodeApi') < js.indexOf("type: 'ready'"), 'acquire 必须先于首次 postMessage');
});
check('callout html flows through page template', () => {
  const html = covemd.parse('> [!WARNING]\n> 小心操作\n');
  assert.ok(html.includes('<details class="callout callout-warning" open>'), html);
  assert.ok(html.includes('<summary class="callout-title">WARNING</summary>'), html);
});
check('extractOutline basic ATX with lines', () => {
  const md = '# A\n\ntext\n## B\n### C\n# D\n';
  const items = extractOutline(md);
  assert.deepStrictEqual(items, [
    { level: 1, text: 'A', line: 0 },
    { level: 2, text: 'B', line: 3 },
    { level: 3, text: 'C', line: 4 },
    { level: 1, text: 'D', line: 5 },
  ]);
});
check('extractOutline skips fenced code', () => {
  const md = '# A\n\n```md\n# not a heading\n~~~\n# also not\n```\n\n## B\n';
  const items = extractOutline(md);
  assert.strictEqual(items.length, 2, JSON.stringify(items));
  assert.strictEqual(items[1].text, 'B');
});
check('extractOutline trailing hashes and CRLF', () => {
  const items = extractOutline('# Close ##\r\n## Next\r\n');
  assert.strictEqual(items[0].text, 'Close');
  assert.strictEqual(items[1].line, 1);
});
check('extractOutline setext not captured (ATX only)', () => {
  const items = extractOutline('Title\n=====\n');
  assert.strictEqual(items.length, 0, JSON.stringify(items));
});
check('headingAtLine picks nearest preceding heading', () => {
  const items = extractOutline('# A\n\npara\n## B\n\ntail\n');
  assert.strictEqual(headingAtLine(items, 0).text, 'A');
  assert.strictEqual(headingAtLine(items, 2).text, 'A');
  assert.strictEqual(headingAtLine(items, 3).text, 'B');
  assert.strictEqual(headingAtLine(items, 5).text, 'B');
  assert.strictEqual(headingAtLine(items, 10).text, 'B');
});

// ---------- safeHtml：脚本剥离兜底 ----------
const { stripScripts } = require(path.join(__dirname, '..', 'out', 'safeHtml.js'));
check('stripScripts removes full script elements', () => {
  assert.strictEqual(stripScripts('<p>a</p><script>alert(1)</script><p>b</p>'), '<p>a</p><p>b</p>');
});
check('stripScripts removes stray script tags (DOM swallowing guard)', () => {
  assert.strictEqual(stripScripts('<code><script></code> 后续内容'), '<code></code> 后续内容');
});
check('stripScripts case-insensitive', () => {
  assert.ok(!/<script/i.test(stripScripts('<SCRIPT src="x"></SCRIPT>')));
});
check('real doc: no raw script after core escape + sanitizer', () => {
  const fs = require('fs');
  const md = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', '需求文档all.md'), 'utf8');
  const html = stripScripts(covemd.parse(md));
  assert.ok(!/<script/i.test(html), '真文档输出含未剥离 script');
  assert.ok(html.includes('&lt;script&gt;'), '行内代码应已转义保留展示');
});

// ---------- 行级双向同步（航点插值） ----------
check('webview implements waypoint interpolation both directions', () => {
  const fs = require('fs');
  const js = fs.readFileSync(path.join(__dirname, '..', 'media', 'main.js'), 'utf8');
  assert.ok(js.includes('function waypoints'), '缺少航点测量');
  assert.ok(js.includes('function lineFromScroll'), '缺少 预览滚动→行号 插值');
  assert.ok(js.includes('function scrollToLine'), '缺少 行号→预览滚动 插值');
  assert.ok(js.includes("type: 'previewScroll'"), '缺少行级回传消息');
  assert.ok(js.includes("'syncScroll'"), '缺少编辑器滚动入口消息');
  assert.ok(js.includes('suppressScrollReport'), '缺少回声抑制（防振荡）');
});
check('outline shows on narrow panels (threshold 380px)', () => {
  const fs = require('fs');
  const js = fs.readFileSync(path.join(__dirname, '..', 'media', 'main.js'), 'utf8');
  assert.ok(js.includes('clientWidth >= 380'), '窄面板阈值应为 380');
});
check('host listens editor viewport scroll for sync', () => {
  const fs2 = require('fs');
  const ts = fs2.readFileSync(path.join(__dirname, '..', 'src', 'preview.ts'), 'utf8');
  assert.ok(ts.includes('onDidChangeTextEditorVisibleRanges'), '宿主必须监听编辑器视口滚动');
  assert.ok(ts.includes("'syncScroll'"), '宿主必须下发 syncScroll');
});

console.log(passed + ' checks passed' + (process.exitCode ? ' (with failures)' : ''));
