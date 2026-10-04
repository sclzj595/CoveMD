/// Smart Outline：从 Markdown 源提取标题树（带行号），供 Outline 侧栏与双向同步使用
/// 仅识别 ATX 标题（# ~######）；围栏代码块（``` / ~~~）内的 # 行不算标题

export interface OutlineItem {
    level: number;  // 1-6
    text: string;   // 标题纯文本（去除 # 与尾随 #）
    line: number;   // 0-based 行号
}

export function extractOutline(text: string): OutlineItem[] {
    const items: OutlineItem[] = [];
    const lines = text.split(/\r\n|\n|\r/);
    let inFence = false;
    let fenceMarker = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fence = line.match(/^\s{0,3}(```+|~~~+)/);
        if (fence) {
            if (!inFence) {
                inFence = true;
                fenceMarker = fence[1][0]; // ` 或 ~
            } else if (fence[1][0] === fenceMarker) {
                inFence = false;
                fenceMarker = '';
            }
            continue;
        }
        if (inFence) continue;
        // ATX：最多 3 空格缩进，1-6 个 #，后接空格或行尾；去除尾随 ###
        const m = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/);
        if (m) {
            const headingText = (m[2] ?? '').trim();
            if (headingText || m[1] === '#') { // 空 # 行（孤立井号）不算有效标题
                items.push({ level: m[1].length, text: headingText, line: i });
            }
        }
    }
    return items;
}

/** 光标行 → 当前所在章节（outline 中 line ≤ cursor 的最近一项） */
export function headingAtLine(outline: OutlineItem[], cursorLine: number): OutlineItem | undefined {
    let best: OutlineItem | undefined;
    for (const item of outline) {
        if (item.line <= cursorLine) best = item;
        else break;
    }
    return best;
}
