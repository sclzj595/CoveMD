/// CoveMD 原生解析模块加载
/// 两种形态：
/// 1. 打包分发（VSIX）：native/covemd_native.node 随插件分发，直接 require .node
/// 2. 本地开发：仓库根 ../binding（npm 包 covemd-parser），由其 index.js 包装加载
import * as path from 'path';

export interface CovemdNative {
    parse(markdown: string, kind?: string): string;
    version: string;
}

export function loadNative(): CovemdNative {
    // 打包形态：out/native.js → out/../native/covemd_native.node
    const bundledPath = path.join(__dirname, '..', 'native', 'covemd_native.node');
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(bundledPath) as CovemdNative;
    } catch {
        // 本地开发形态：out/native.js → out/../.. = 仓库根 → /binding
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const native: CovemdNative = require(path.join(__dirname, '..', '..', 'binding'));
            return native;
        } catch (err) {
            throw new Error(
                '[CoveMD] 原生解析模块加载失败。打包安装形态应包含 native/covemd_native.node；' +
                '本地开发请在仓库 binding/ 目录执行 `npm install && npx cmake-js compile`。原始错误: ' +
                ((err as Error).message ?? String(err))
            );
        }
    }
}
