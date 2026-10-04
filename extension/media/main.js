/* CoveMD Webview 渲染脚本（CSP：仅本插件资源，nonce 加载）
   职责：postMessage 增量更新、代码块增强（复制/语言标签）、链接经宿主打开、
   Smart Outline 侧栏 + 双向同步（M4） */
'use strict';

(function () {
  // 宿主通道：acquireVsCodeApi 全生命周期只允许调用一次，故先判空再取
  if (!window.__covemdHost) {
    try {
      window.__covemdHost = acquireVsCodeApi();
    } catch (e) {
      window.__covemdHost = { postMessage: function () {} }; // 非 VSCode 环境（纯浏览器调试）静默降级
    }
  }
  var content = document.getElementById('content');
  var app = document.getElementById('app');
  var outlineEl = document.getElementById('outline');
  var outlineNav = document.getElementById('outline-nav');
  var outlineItems = [];          // [{level,text,line}]
  var activeOutlineLine = null;   // 当前高亮的 outline line

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- Outline 侧栏 ----------
  function renderOutline(items, showOutline) {
    outlineItems = items || [];
    outlineNav.innerHTML = '';
    var visible = showOutline !== false && outlineItems.length > 1 && app.clientWidth >= 380;
    outlineEl.hidden = !visible;
    if (!visible) return;
    var minLevel = Math.min.apply(null, outlineItems.map(function (o) { return o.level; }));
    outlineItems.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'outline-item lv' + item.level;
      btn.style.paddingLeft = (10 + (item.level - minLevel) * 14) + 'px';
      btn.textContent = item.text;
      btn.title = item.text;
      btn.dataset.line = String(item.line);
      btn.addEventListener('click', function () {
        window.__covemdHost.postMessage({ type: 'openHeading', line: item.line });
        setActiveOutline(item.line, false);
        scrollToHeadingEl(item.text);
      });
      outlineNav.appendChild(btn);
    });
    if (activeOutlineLine !== null) setActiveOutline(activeOutlineLine, false);
  }

  function setActiveOutline(line, scrollOutlineNav) {
    activeOutlineLine = line;
    outlineNav.querySelectorAll('.outline-item.active').forEach(function (el) {
      el.classList.remove('active');
    });
    if (line === null) return;
    var target = outlineNav.querySelector('.outline-item[data-line="' + line + '"]');
    if (target) {
      target.classList.add('active');
      if (scrollOutlineNav !== false) {
        var navRect = outlineNav.getBoundingClientRect();
        var elRect = target.getBoundingClientRect();
        if (elRect.top < navRect.top || elRect.bottom > navRect.bottom) {
          target.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }

  // 正文 h1-h6 元素按 text 匹配（同一文档标题序与 outline 序一致；setext 标题 outline 无 → 匹配不到即跳过）
  function headingEls() {
    return content.querySelectorAll('h1,h2,h3,h4,h5,h6');
  }
  function scrollToHeadingEl(text) {
    var els = headingEls();
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent.trim() === text) {
        els[i].scrollIntoView({ block: 'start', behavior: 'auto' });
        return true;
      }
    }
    return false;
  }

  // ---------- 行级双向同步航点 ----------
  // 航点 = 标题元素(预览内 offsetTop) ↔ 源行号。段内滚动位置按线性插值映射，
  // 实现「两边任意位置同步」而非仅标题跳转。DOM 标题数与 outline 数一致时按下标对齐，
  // 否则退化为按标题文本匹配。
  function elTop(el) {
    return el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
  }
  var wpEls = null; // 航点缓存占位（当前直接实时测量，保留扩展点）
  function waypoints() {
    var els = headingEls();
    if (!outlineItems.length || !els.length) return [];
    var wps = [];
    if (els.length === outlineItems.length) {
      for (var i = 0; i < els.length; i++) {
        wps.push({ line: outlineItems[i].line, top: elTop(els[i]) });
      }
    } else {
      for (var j = 0; j < outlineItems.length; j++) {
        for (var k = 0; k < els.length; k++) {
          if (els[k].textContent.trim() === outlineItems[j].text) {
            wps.push({ line: outlineItems[j].line, top: elTop(els[k]) });
            break;
          }
        }
      }
    }
    return wps;
  }
  // 预览滚动位置 → 源行号（插值）
  function lineFromScroll() {
    var wps = wpEls || waypoints();
    if (!wps.length) return null;
    var probe = (window.pageYOffset || document.documentElement.scrollTop || 0) + 40;
    if (probe <= wps[0].top) {
      // 首航点之上：按比例映射到首航点之前的源行
      var r0 = wps[0].top > 0 ? Math.max(0, probe / wps[0].top) : 1;
      return Math.max(0, Math.round(wps[0].line * r0));
    }
    for (var i = 0; i < wps.length - 1; i++) {
      if (probe >= wps[i].top && probe < wps[i + 1].top) {
        var r = (probe - wps[i].top) / Math.max(1, wps[i + 1].top - wps[i].top);
        return Math.round(wps[i].line + r * (wps[i + 1].line - wps[i].line));
      }
    }
    return wps[wps.length - 1].line;
  }
  // 源行号 → 预览滚动（插值），syncScroll 消息入口
  var suppressScrollReport = 0;
  function scrollToLine(line) {
    var wps = wpEls || waypoints();
    if (!wps.length) return;
    var target;
    if (line <= wps[0].line) {
      target = wps[0].line > 0 ? (line / wps[0].line) * wps[0].top : 0;
    } else {
      var seg = -1;
      for (var i = 0; i < wps.length - 1; i++) {
        if (line >= wps[i].line && line < wps[i + 1].line) { seg = i; break; }
      }
      if (seg < 0) {
        target = wps[wps.length - 1].top;
      } else {
        var r = (line - wps[seg].line) / Math.max(1, wps[seg + 1].line - wps[seg].line);
        target = wps[seg].top + r * (wps[seg + 1].top - wps[seg].top);
      }
    }
    suppressScrollReport = Date.now(); // 本次滚动由编辑器驱动，抑制回传防振荡
    window.scrollTo(0, Math.max(0, target - 40));
  }

  // ---------- 预览滚动 → 宿主反查 ----------
  var scrollReportTimer = null;
  function reportScroll() {
    // 由 syncScroll 驱动的滚动不回传（防振荡），但大纲高亮仍更新
    var editorDriven = Date.now() - suppressScrollReport < 300;
    // 视口顶部下方 40px 内最近的标题视为当前章节
    var els = headingEls();
    var top = 40;
    var found = null;
    for (var i = 0; i < els.length; i++) {
      if (els[i].getBoundingClientRect().top <= top) found = els[i];
      else break;
    }
    var text = found ? found.textContent.trim() : null;
    // 顶部之上无标题 → 回第一项
    if (!found && els.length && els[0].getBoundingClientRect().top > top) text = els[0].textContent.trim();
    if (text) {
      for (var j = 0; j < outlineItems.length; j++) {
        if (outlineItems[j].text === text) { setActiveOutline(outlineItems[j].line, true); break; }
      }
    } else {
      setActiveOutline(null, false);
    }
    if (!editorDriven) {
      var line = lineFromScroll();
      if (line !== null) {
        window.__covemdHost.postMessage({ type: 'previewScroll', line: line });
      } else if (text) {
        // 无航点时退化为文本反查（旧协议兼容）
        window.__covemdHost.postMessage({ type: 'previewScrolled', text: text });
      }
    }
  }
  window.addEventListener('scroll', function () {
    if (scrollReportTimer) clearTimeout(scrollReportTimer);
    scrollReportTimer = setTimeout(reportScroll, 120);
  }, { passive: true });

  // ---------- 代码块增强 ----------
  function enhanceCodeBlocks() {
    content.querySelectorAll('pre').forEach(function (pre) {
      if (pre.querySelector('.cv-copy')) return;
      var btn = document.createElement('button');
      btn.className = 'cv-copy';
      btn.type = 'button';
      btn.textContent = '复制';
      btn.addEventListener('click', function () {
        var code = pre.querySelector('code');
        var text = code ? code.textContent : '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = '已复制';
            btn.classList.add('copied');
            setTimeout(function () {
              btn.textContent = '复制';
              btn.classList.remove('copied');
            }, 1500);
          });
        }
      });
      pre.appendChild(btn);

      var codeEl = pre.querySelector('code');
      if (codeEl && codeEl.className) {
        var m = codeEl.className.match(/language-([\w+-]+)/);
        if (m && m[1]) {
          var tag = document.createElement('span');
          tag.className = 'cv-code-lang';
          tag.textContent = m[1];
          pre.appendChild(tag);
        }
      }
    });
  }

  // 表格超宽横向滚动降级（窄面板）
  function wrapWideTables() {
    content.querySelectorAll('table').forEach(function (table) {
      if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  // 链接一律经宿主 vscode.open 打开（UI 规范 6.12，不在 Webview 内 window.open）
  content.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) {
      e.preventDefault();
      window.__covemdHost.postMessage({ type: 'openLink', href: a.getAttribute('href') });
    }
  });

  // ---------- 宿主消息 ----------
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'update' && typeof msg.html === 'string') {
      // 更新前记录当前章节标题，替换后恢复位置（全量 innerHTML 替换会丢滚动）
      var els = headingEls();
      var top = 40;
      var anchorText = null;
      for (var i = 0; i < els.length; i++) {
        if (els[i].getBoundingClientRect().top <= top) anchorText = els[i].textContent.trim();
        else break;
      }
      content.innerHTML = msg.html;
      enhanceCodeBlocks();
      wrapWideTables();
      if (anchorText) scrollToHeadingEl(anchorText);
      reportScroll();
      return;
    }
    if (msg.type === 'syncScroll' && typeof msg.line === 'number') {
      // 编辑器视口滚动 → 预览插值滚动（行级，任意位置）
      scrollToLine(msg.line);
      return;
    }
    if (msg.type === 'outline' && Array.isArray(msg.items)) {
      renderOutline(msg.items, msg.showOutline);
      reportScroll();
      return;
    }
    if (msg.type === 'scrollToHeading' && typeof msg.text === 'string') {
      scrollToHeadingEl(msg.text);
      for (var k = 0; k < outlineItems.length; k++) {
        if (outlineItems[k].text === msg.text) { setActiveOutline(outlineItems[k].line, true); break; }
      }
      return;
    }
  });

  // 首帧 HTML 由 Extension 内联注入，同样需要增强
  enhanceCodeBlocks();
  wrapWideTables();
  // 就绪握手：脚本加载完成后再向宿主要 outline/scrollToHeading（
  // 宿主 set html 后立刻 postMessage 会早于本监听器注册而被丢弃）
  window.__covemdHost.postMessage({ type: 'ready' });
})();
