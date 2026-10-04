/// 预览面板管理：单例 Webview + 文档绑定 + 300ms 防抖增量推送
/// M4：Smart Outline 推送 + 双向同步（编辑器光标→预览滚动；预览滚动→编辑器 reveal）
import * as vscode from 'vscode';
import * as path from 'path';
import { renderPage, getNonce } from './page';
import { CovemdNative } from './native';
import { extractOutline, headingAtLine, OutlineItem } from './outline';
import { stripScripts } from './safeHtml';

const DEBOUNCE_MS = 300;
const SYNC_DEBOUNCE_MS = 150;
const SCROLL_SYNC_DEBOUNCE_MS = 120;

export class PreviewPanel {
    private panel?: vscode.WebviewPanel;
    private doc?: vscode.TextDocument;
    private debounce?: ReturnType<typeof setTimeout>;
    private syncDebounce?: ReturnType<typeof setTimeout>;
    private scrollDebounce?: ReturnType<typeof setTimeout>;
    private disposables: vscode.Disposable[] = [];
    private outline: OutlineItem[] = [];
    // 预览滚动反查 reveal 后短暂抑制滚动同步，防止 往返振荡
    private suppressSyncUntil = 0;
    private readonly parse: (md: string, kind?: string) => string;

    constructor(private readonly context: vscode.ExtensionContext, native: CovemdNative) {
        this.parse = (md, kind) =>
            native.parse(md, kind ?? vscode.workspace.getConfiguration('covemd').get<string>('parser') ?? 'maddy');

        // 编辑器光标跟随（全局注册一次，回调内判断面板与文档绑定）
        vscode.window.onDidChangeTextEditorSelection((e) => {
            if (!this.panel || !this.doc) return;
            if (e.textEditor.document.uri.toString() !== this.doc.uri.toString()) return;
            if (Date.now() < this.suppressSyncUntil) return;
            this.clearSyncDebounce();
            this.syncDebounce = setTimeout(() => this.pushCursorHeading(), SYNC_DEBOUNCE_MS);
        }, this, this.disposables);

        // 编辑器视口滚动跟随（行级双向同步：编辑器任意滚动位置 → 预览插值滚动）
        vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
            if (!this.panel || !this.doc) return;
            if (e.textEditor.document.uri.toString() !== this.doc.uri.toString()) return;
            if (Date.now() < this.suppressSyncUntil) return;
            const line = e.visibleRanges.length ? e.visibleRanges[0].start.line : undefined;
            if (typeof line !== 'number') return;
            if (this.scrollDebounce) clearTimeout(this.scrollDebounce);
            this.scrollDebounce = setTimeout(() => {
                if (!this.panel) return;
                void this.panel.webview.postMessage({ type: 'syncScroll', line });
            }, SCROLL_SYNC_DEBOUNCE_MS);
        }, this, this.disposables);
    }

    open(doc: vscode.TextDocument): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'covemdPreview',
                'CoveMD 预览',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
                }
            );
            this.panel.onDidDispose(() => {
                this.clearDebounce();
                this.clearSyncDebounce();
                this.clearScrollDebounce();
                this.panel = undefined;
                this.doc = undefined;
            }, null, this.disposables);
            this.panel.webview.onDidReceiveMessage((msg) => this.onWebviewMessage(msg), null, this.disposables);
        }
        this.doc = doc;
        this.outline = extractOutline(doc.getText());
        this.panel.title = `CoveMD: ${path.basename(doc.fileName)}`;
        this.renderFull();
    }

    onDocumentChanged(doc: vscode.TextDocument): void {
        if (!this.panel || !this.doc || doc.uri.toString() !== this.doc.uri.toString()) return;
        this.clearDebounce();
        this.debounce = setTimeout(() => this.pushUpdate(), DEBOUNCE_MS);
    }

    onActiveEditorChanged(doc: vscode.TextDocument | undefined): void {
        // 预览已打开且切到另一篇 Markdown → 重绑文档并全量刷新
        if (this.panel && doc && (!this.doc || doc.uri.toString() !== this.doc.uri.toString())) {
            this.open(doc);
        }
    }

    dispose(): void {
        this.clearDebounce();
        this.clearSyncDebounce();
        this.clearScrollDebounce();
        this.panel?.dispose();
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }

    private clearScrollDebounce(): void {
        if (this.scrollDebounce) {
            clearTimeout(this.scrollDebounce);
            this.scrollDebounce = undefined;
        }
    }

    private clearDebounce(): void {
        if (this.debounce) {
            clearTimeout(this.debounce);
            this.debounce = undefined;
        }
    }

    private clearSyncDebounce(): void {
        if (this.syncDebounce) {
            clearTimeout(this.syncDebounce);
            this.syncDebounce = undefined;
        }
    }

    private parseCurrent(): string {
        // stripScripts：maddy 原生 HTML 直通的兜底剥离（见 safeHtml.ts）
        return this.doc ? stripScripts(this.parse(this.doc.getText())) : '';
    }

    /** 绑定文档对应的可见编辑器。不能用 activeTextEditor：点/滚预览时焦点在 Webview，activeTextEditor 为 undefined */
    private get boundEditor(): vscode.TextEditor | undefined {
        if (!this.doc) return undefined;
        const uri = this.doc.uri.toString();
        return vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri);
    }

    private renderFull(): void {
        if (!this.panel || !this.doc) return;
        const webview = this.panel.webview;
        const html = this.parseCurrent();
        this.panel.webview.html = renderPage({
            scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js')).toString(),
            cssUri: webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.css')).toString(),
            cspSource: webview.cspSource,
            initialHtml: html,
            version: this.context.extension.packageJSON.version as string,
        });
        // outline/cursor 推送等 webview ready 握手后再发（见 onWebviewMessage 'ready'）
    }

    private pushUpdate(): void {
        if (!this.panel) return;
        if (this.doc) this.outline = extractOutline(this.doc.getText());
        void this.panel.webview.postMessage({ type: 'update', html: this.parseCurrent() });
        this.pushOutline();
    }

    private pushOutline(): void {
        if (!this.panel) return;
        void this.panel.webview.postMessage({
            type: 'outline',
            items: this.outline,
            showOutline: vscode.workspace.getConfiguration('covemd').get<boolean>('outline', true),
        });
    }

    /** 编辑器光标 → 所在章节标题 → 预览滚动 + Outline 高亮 */
    private pushCursorHeading(): void {
        if (!this.panel || !this.doc) return;
        const editor = this.boundEditor;
        if (!editor) return;
        const heading = headingAtLine(this.outline, editor.selection.active.line);
        if (heading) {
            void this.panel.webview.postMessage({
                type: 'scrollToHeading',
                text: heading.text,
                line: heading.line,
            });
        }
    }

    private onWebviewMessage(msg: { type?: string; href?: string; text?: string; line?: number }): void {
        if (msg.type === 'ready') {
            // webview 脚本就绪：现在推大纲与当前章节才不会被丢弃
            this.pushOutline();
            this.pushCursorHeading();
            return;
        }
        if (msg.type === 'openLink' && typeof msg.href === 'string' && /^https?:\/\//i.test(msg.href)) {
            void vscode.env.openExternal(vscode.Uri.parse(msg.href));
            return;
        }
        if (!this.doc) return;
        const editor = this.boundEditor;
        if (!editor) return;

        if (msg.type === 'openHeading' && typeof msg.line === 'number') {
            const pos = new vscode.Position(msg.line, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(msg.line, 0, msg.line, 0), vscode.TextEditorRevealType.Default);
            return;
        }
        if (msg.type === 'previewScroll' && typeof msg.line === 'number') {
            // 预览滚动反查（行级插值，任意位置）：编辑器视口顶部对齐该行；
            // 仅动视口不动光标（不触发 selection 循环），并短暂抑制滚动同步防振荡
            this.suppressSyncUntil = Date.now() + 400;
            const target = this.boundEditor;
            if (target) {
                target.revealRange(
                    new vscode.Range(msg.line, 0, Math.min(msg.line + 1, this.doc.lineCount - 1), 0),
                    vscode.TextEditorRevealType.AtTop
                );
            }
            return;
        }
        if (msg.type === 'previewScrolled' && typeof msg.text === 'string') {
            // 兼容旧消息（文本反查）：按标题文本回 outline 定位行号
            const item = this.outline.find((o) => o.text === msg.text);
            if (item) {
                this.suppressSyncUntil = Date.now() + 400;
                editor.revealRange(new vscode.Range(item.line, 0, item.line, 0), vscode.TextEditorRevealType.Default);
            }
        }
    }
}

export { getNonce };
