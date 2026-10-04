/// HTML 安全过滤（PRD 风险表 M3 决策的最小实现）
/// maddy 按 GFM 惯例允许块级原生 HTML 直通；CSP 已拦脚本执行，
/// 但被拦的 <script> 开标签仍会吞掉页面后续 DOM（真机踩实）——这里兜底剥离。
/// 行内代码转义已在 Core 修复（vendored 补丁 #4），此层为纵深防御。

export function stripScripts(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
        .replace(/<\/?script\b[^>]*>/gi, '');
}
