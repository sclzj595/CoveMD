'use strict';

const path = require('path');

// 加载编译产物：cmake-js --out build 时输出 build/*.node，默认约定为 build/Release/*.node
let native;
const candidates = [
  path.join(__dirname, 'build', 'covemd_native.node'),
  path.join(__dirname, 'build', 'Release', 'covemd_native.node'),
];
let loadErr = null;
for (const p of candidates) {
  try {
    native = require(p);
    break;
  } catch (err) {
    loadErr = err;
  }
}
if (!native) {
  throw new Error('[covemd-parser] 原生模块未编译，请先执行 `npm run build`：' + (loadErr && loadErr.message));
}

/**
 * Markdown -> HTML（UTF-8 进出）
 * @param {string} markdown Markdown 源文本
 * @param {string} [kind='maddy'] 解析器：'maddy'（默认）| 'simple'（自研 fallback）
 * @returns {string} body-only HTML 片段
 */
function parse(markdown, kind) {
  return native.parse(markdown, kind);
}

module.exports = { parse, version: native.version };
