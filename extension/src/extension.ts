/// CoveMD VSCode 插件入口
import * as vscode from 'vscode';
import { PreviewPanel } from './preview';
import { loadNative } from './native';

export function activate(context: vscode.ExtensionContext): void {
    let native;
    try {
        native = loadNative();
    } catch (err) {
        void vscode.window.showErrorMessage((err as Error).message);
        return;
    }

    const manager = new PreviewPanel(context, native);

    context.subscriptions.push(
        vscode.commands.registerCommand('covemd.openPreview', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'markdown') {
                void vscode.window.showInformationMessage('CoveMD：请先打开一个 Markdown 文件');
                return;
            }
            manager.open(editor.document);
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.languageId === 'markdown') manager.onDocumentChanged(e.document);
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.languageId === 'markdown') manager.onActiveEditorChanged(editor.document);
        }),
        manager
    );
}

export function deactivate(): void {
    // manager 已通过 context.subscriptions 管理
}
