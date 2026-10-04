'use strict';
// CoveMD 原生绑定测试：功能 + 参数校验 + 性能冒烟
const assert = require('assert');
const covemd = require('./index.js');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS ' + name);
  } catch (e) {
    console.error('  FAIL ' + name + ' -> ' + e.message);
    process.exitCode = 1;
  }
}

console.log('covemd-parser v' + covemd.version + ' (' + process.platform + ' node ' + process.version + ')');

// ---------- maddy（默认） ----------
check('parse returns string', () => {
  assert.strictEqual(typeof covemd.parse('# Hi\n'), 'string');
});
check('h1 rendering', () => {
  const html = covemd.parse('# 标题一\n');
  assert.ok(/<h1[^>]*>\s*标题一\s*<\/h1>/.test(html), 'got: ' + html);
});
check('bold / inline code / strikethrough', () => {
  const html = covemd.parse('**加粗** 与 `code` 与 ~~删~~\n');
  assert.ok(html.includes('<strong>加粗</strong>'), html);
  assert.ok(html.includes('<code>code</code>'), html);
  assert.ok(/<(s|del)>删<\/(s|del)>/.test(html), html);
});
check('code block with language class', () => {
  const html = covemd.parse('```js\nlet x = 1;\n```\n');
  assert.ok(html.includes('language-js'), html);
});
check('chinese round trip', () => {
  const html = covemd.parse('中文段落，标点：，。！\n');
  assert.ok(html.includes('中文段落，标点：，。！'), html);
});
check('table output', () => {
  const html = covemd.parse('| a | b |\n|:---:|---:|\n| 1 | 2 |\n');
  assert.ok(html.includes('<table>'), html);
  assert.ok(html.includes('text-align:center'), html);
});

// ---------- callout（M4，五类型 + 折叠） ----------
check('callout NOTE becomes details', () => {
  const html = covemd.parse('> [!NOTE]\n> 提示内容\n');
  assert.ok(html.includes('<details class="callout callout-note" open>'), html);
  assert.ok(html.includes('<summary class="callout-title">NOTE</summary>'), html);
  assert.ok(html.includes('提示内容'), html);
  assert.ok(html.includes('</details>'), html);
});
check('callout five types map to classes', () => {
  const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
  for (const t of types) {
    const html = covemd.parse('> [!' + t + ']\n> x\n');
    assert.ok(html.includes('callout-' + t.toLowerCase()), t + ' -> ' + html);
  }
});
check('callout collapsed via minus', () => {
  const html = covemd.parse('> [!WARNING]-\n> 收起内容\n');
  assert.ok(html.includes('<details class="callout callout-warning">'), 'no open attr: ' + html);
  assert.ok(!html.includes('"callout callout-warning" open'), 'should not be open: ' + html);
});
check('callout with inline bold in body', () => {
  const html = covemd.parse('> [!TIP]\n> 支持 **加粗** 行内语法\n');
  assert.ok(html.includes('<strong>加粗</strong>'), html);
});
check('callout with custom title', () => {
  const html = covemd.parse('> [!IMPORTANT] 自定义标题\n> 内容\n');
  assert.ok(html.includes('IMPORTANT: 自定义标题'), html);
});
check('plain quote unchanged (no callout false positive)', () => {
  const html = covemd.parse('> 普通引用 [!NOTE] 不在行首\n');
  assert.ok(html.includes('<blockquote>'), html);
  assert.ok(!html.includes('callout'), html);
});
check('blockquote still works alongside callout', () => {
  const html = covemd.parse('> 引用\n\n> [!NOTE]\n> 提示\n\n普通段落\n');
  assert.ok(html.includes('<blockquote>'), html);
  assert.ok(html.includes('<details class="callout'), html);
  assert.ok(/<p>普通段落\s*<\/p>/.test(html), html);
});

// ---------- 行内代码转义（vendored 补丁 #4：防 <script> 直通） ----------
check('inline code escapes script tag (no raw passthrough)', () => {
  const html = covemd.parse('用法：`<script>alert(1)</script>` 注意\n');
  assert.ok(html.includes('<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>'), html);
  assert.ok(!html.includes('<script'), '输出禁止出现未转义 <script>: ' + html);
});
check('inline code escapes ampersand first (no double escaping)', () => {
  const html = covemd.parse('`a & b < c`');
  assert.ok(html.includes('<code>a &amp; b &lt; c</code>'), html);
});
check('inline code normal text unaffected', () => {
  const html = covemd.parse('`plain_code` 与 `x-y`');
  assert.ok(html.includes('<code>plain_code</code>'), html);
  assert.ok(html.includes('<code>x-y</code>'), html);
});

// ---------- simple（自研 fallback） ----------
check("kind='simple' works", () => {
  const html = covemd.parse('# T\n\n- [x] done\n', 'simple');
  assert.ok(html.includes('<h1'), html);
  assert.ok(html.includes('checkbox'), html);
});

// ---------- 参数校验 ----------
check('missing arg throws TypeError', () => {
  assert.throws(() => covemd.parse(), TypeError);
});
check('non-string arg throws TypeError', () => {
  assert.throws(() => covemd.parse(123), TypeError);
  assert.throws(() => covemd.parse(null), TypeError);
});
check('non-string kind throws TypeError', () => {
  assert.throws(() => covemd.parse('# x\n', 42), TypeError);
});

// ---------- 性能冒烟 ----------
// 已知基线：5.5KB 文档单次约 20ms（std::regex 开销），控制次数避免测试超时
check('perf smoke: 200 calls on ~5.5KB doc', () => {
  const doc = ('# CoveMD 性能基准\n\n这是**一段**中文段落，包含 `代码` 与 [链接](https://example.com)。\n\n' +
    '- 列表项一\n- 列表项二\n- [x] 任务\n\n> 引用文本\n\n' +
    '| 列1 | 列2 | 列3 |\n|:---|---:|:---:|\n| a | 1 | x |\n').repeat(40);
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) covemd.parse(doc);
  const ms = Date.now() - t0;
  const avg = (ms / 200).toFixed(2);
  console.log('  INFO ' + doc.length + 'B doc x 200 calls = ' + ms + 'ms total, ' + avg + 'ms/call');
});

console.log(passed + ' checks passed' + (process.exitCode ? ' (with failures)' : ''));
