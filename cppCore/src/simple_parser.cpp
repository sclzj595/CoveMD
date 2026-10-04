/// 自研轻量 Markdown 解析器（fallback 实现）
/// 从 SoulCove Qt 版 MarkdownParser 转换而来（QString→std::string，
/// QRegularExpression→std::regex / 手写扫描）。
///
/// 与旧版的差异：
/// - 移除主题 CSS 内嵌（ThemeManager）：输出 body-only HTML，样式由 Webview 负责
/// - 移除复制按钮/语言标签的内联实现：Webview 按语言 class 自行注入交互件
/// - 新增段落文本 HTML 转义（旧版未转义，存在注入风险），行内代码段内容隔离保护
/// - 修复旧版列表混排 bug：有序/无序/任务列表相邻时先关闭前一个列表
/// - 支持 Windows 换行（剥离行尾 '\r'）
#include "parser_impl.h"

#include <cstring>
#include <regex>
#include <vector>

namespace covemd {
namespace {

// ============================ 基础字符串工具 ============================

std::string trim(const std::string& s)
{
    size_t b = 0, e = s.size();
    while (b < e && (s[b] == ' ' || s[b] == '\t' || s[b] == '\r' || s[b] == '\n')) ++b;
    while (e > b && (s[e - 1] == ' ' || s[e - 1] == '\t' || s[e - 1] == '\r' || s[e - 1] == '\n')) --e;
    return s.substr(b, e - b);
}

std::vector<std::string> splitLines(const std::string& text)
{
    std::vector<std::string> lines;
    size_t start = 0;
    while (true) {
        size_t pos = text.find('\n', start);
        if (pos == std::string::npos) {
            lines.push_back(text.substr(start));
            break;
        }
        lines.push_back(text.substr(start, pos - start));
        start = pos + 1;
    }
    for (auto& l : lines) { // Windows 换行兼容
        if (!l.empty() && l.back() == '\r') l.pop_back();
    }
    return lines;
}

std::vector<std::string> splitChar(const std::string& s, char sep)
{
    std::vector<std::string> out;
    size_t start = 0;
    while (true) {
        size_t pos = s.find(sep, start);
        if (pos == std::string::npos) {
            out.push_back(s.substr(start));
            break;
        }
        out.push_back(s.substr(start, pos - start));
        start = pos + 1;
    }
    return out;
}

std::string replaceAll(std::string s, const std::string& from, const std::string& to)
{
    if (from.empty()) return s;
    size_t pos = 0;
    while ((pos = s.find(from, pos)) != std::string::npos) {
        s.replace(pos, from.size(), to);
        pos += to.size();
    }
    return s;
}

/// HTML 实体转义（& < >）
std::string escapeHtml(const std::string& text)
{
    std::string r = replaceAll(text, "&", "&amp;");
    r = replaceAll(r, "<", "&lt;");
    r = replaceAll(r, ">", "&gt;");
    return r;
}

/// 属性值转义（文本已先做过 escapeHtml，此处补引号）
std::string escapeAttr(const std::string& text)
{
    return replaceAll(text, "\"", "&quot;");
}

/// 带回调的正则替换（等价 QString::replace(re, functor)）
template <typename Fn>
std::string regexReplaceCb(const std::string& input, const std::regex& re, Fn&& fn)
{
    std::string result;
    result.reserve(input.size());
    size_t last = 0;
    for (std::sregex_iterator it(input.begin(), input.end(), re), end; it != end; ++it) {
        const auto& m = *it;
        const size_t pos = static_cast<size_t>(m.position());
        const size_t len = static_cast<size_t>(m.length());
        result.append(input, last, pos - last);
        result += fn(m);
        last = pos + (len > 0 ? len : 1); // 防零长匹配死循环
    }
    result.append(input, last, input.size() - last);
    return result;
}

// ============================ 行内解析 ============================

/// 除行内代码之外的行内规则（输入应为已 HTML 转义文本）
std::string applyInlineRules(const std::string& in)
{
    static const std::regex strikeRe {"~~(.+?)~~"};
    static const std::regex boldRe   {R"(\*\*(.+?)\*\*)"};
    // 斜体：std::regex(ECMAScript 文法) 不支持 lookbehind，
    // 用「* 后首字符非 * 非空白」约束等价替代旧式 (?<!\*)\*(?!\*)
    static const std::regex italicRe {R"(\*([^*\s][^*]*?)\*)"};
    static const std::regex imgRe    {R"(!\[([^\]]*)\]\(([^)]+)\))"};
    static const std::regex linkRe   {R"(\[([^\]]+)\]\(([^)]+)\))"};

    std::string s = in;
    s = regexReplaceCb(s, strikeRe, [](const std::smatch& m) {
        return "<del>" + m[1].str() + "</del>";
    });
    s = regexReplaceCb(s, boldRe, [](const std::smatch& m) {
        return "<strong>" + m[1].str() + "</strong>";
    });
    s = regexReplaceCb(s, italicRe, [](const std::smatch& m) {
        return "<em>" + m[1].str() + "</em>";
    });
    s = regexReplaceCb(s, imgRe, [](const std::smatch& m) {
        return "<img src=\"" + escapeAttr(m[2].str()) + "\" alt=\"" + m[1].str() + "\">";
    });
    s = regexReplaceCb(s, linkRe, [](const std::smatch& m) {
        return "<a href=\"" + escapeAttr(m[2].str()) + "\">" + m[1].str() + "</a>";
    });
    return s;
}

/// 行内解析：先整体 HTML 转义，再按行内代码分段隔离，
/// 代码段内容不参与后续替换（保护 * ~ [ 等字符的字面展示）
std::string parseInline(const std::string& text)
{
    static const std::regex codeRe {"`([^`]+)`"};
    const std::string escaped = escapeHtml(text);

    std::string result;
    result.reserve(escaped.size() + 16);
    size_t last = 0;
    for (std::sregex_iterator it(escaped.begin(), escaped.end(), codeRe), end; it != end; ++it) {
        const auto& m = *it;
        const size_t pos = static_cast<size_t>(m.position());
        const size_t len = static_cast<size_t>(m.length());
        result += applyInlineRules(escaped.substr(last, pos - last));
        result += "<code>" + m[1].str() + "</code>";
        last = pos + (len > 0 ? len : 1);
    }
    result += applyInlineRules(escaped.substr(last));
    return result;
}

/// 标题锚点 ID：ASCII 小写化，保留 [a-z0-9_-] 与全部非 ASCII 字节（CJK 等）
std::string makeAnchorId(const std::string& text)
{
    std::string id;
    id.reserve(text.size());
    for (unsigned char ch : text) {
        if (ch >= 'A' && ch <= 'Z') {
            id += static_cast<char>(ch - 'A' + 'a');
        } else if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ||
                   ch == '-' || ch == '_' || ch >= 0x80) {
            id += static_cast<char>(ch);
        }
    }
    static const std::regex sepRe {R"(_{2,}|-{2,})"};
    id = std::regex_replace(id, sepRe, "-");
    const size_t b = id.find_first_not_of("-_");
    if (b == std::string::npos) return {};
    const size_t e = id.find_last_not_of("-_");
    return id.substr(b, e - b + 1);
}

// ============================ 块级：表格 ============================

std::vector<std::string> parseRow(const std::string& line)
{
    std::string t = trim(line);
    if (!t.empty() && t.front() == '|') t.erase(0, 1);
    if (!t.empty() && t.back() == '|') t.pop_back();

    std::vector<std::string> cells;
    cells.reserve(8);
    for (auto& cell : splitChar(t, '|')) {
        cells.push_back(trim(cell));
    }
    return cells;
}

std::string parseTable(const std::vector<std::string>& lines)
{
    if (lines.size() < 2) return {};

    const std::vector<std::string> headerCells = parseRow(lines[0]);
    const std::vector<std::string> alignCells  = parseRow(lines[1]);

    std::string html = "<table><thead><tr>";
    for (size_t i = 0; i < headerCells.size(); ++i) {
        std::string align;
        if (i < alignCells.size()) {
            const std::string& a = alignCells[i];
            if (!a.empty() && a.front() == ':' && a.back() == ':') align = " style=\"text-align:center\"";
            else if (!a.empty() && a.back() == ':')                align = " style=\"text-align:right\"";
        }
        html += "<th" + align + ">" + parseInline(headerCells[i]) + "</th>";
    }
    html += "</tr></thead><tbody>";

    for (size_t i = 2; i < lines.size(); ++i) {
        const std::vector<std::string> cells = parseRow(lines[i]);
        html += "<tr>";
        for (size_t j = 0; j < headerCells.size() && j < cells.size(); ++j) {
            html += "<td>" + parseInline(cells[j]) + "</td>";
        }
        html += "</tr>";
    }
    html += "</tbody></table>";
    return html;
}

// ============================ 主体状态机 ============================

class SimpleParser final : public IMarkdownParser
{
public:
    std::string toHtml(const std::string& markdown) override
    {
        const std::vector<std::string> lines = splitLines(markdown);

        std::string html;
        html.reserve(markdown.size() * 2);

        bool inCodeBlock = false;
        std::string codeBlockContent, codeBlockLang;
        bool inTable = false;
        std::vector<std::string> tableLines;
        bool inUnorderedList = false, inOrderedList = false;
        std::vector<std::string> listItems;
        std::vector<std::string> paragraph;

        static const std::regex hRe      {R"(^(#{1,6})\s+(.+)$)"};
        static const std::regex hrRe     {R"((-{3,}|\*{3,}|_{3,})\s*$)"};
        static const std::regex quoteRe  {R"(^> (.+)$)"};
        static const std::regex taskRe   {R"(^\s*-\s+\[([ xX])\]\s+(.+)$)"};
        static const std::regex ulRe     {R"(^[*-]\s+(.+)$)"};
        static const std::regex olRe     {R"(^\d+\.\s+(.+)$)"};

        auto flushParagraph = [&] {
            if (paragraph.empty()) return;
            std::string text;
            for (size_t i = 0; i < paragraph.size(); ++i) {
                if (i) text += '\n';
                text += paragraph[i];
            }
            html += "<p>" + parseInline(text) + "</p>\n";
            paragraph.clear();
        };

        auto flushList = [&] {
            if (listItems.empty()) { inUnorderedList = inOrderedList = false; return; }
            const char* tag = inUnorderedList ? "ul" : "ol";
            html += std::string("<") + tag + ">\n";
            for (const auto& item : listItems) {
                html += std::string("<li>") + item + "</li>\n";
            }
            html += std::string("</") + tag + ">\n";
            listItems.clear();
            inUnorderedList = inOrderedList = false;
        };

        // 修复旧版混排 bug：切换列表类型时先关闭上一个列表
        auto startList = [&](bool ordered) {
            if (ordered ? inOrderedList : inUnorderedList) return;
            flushList();
            if (ordered) inOrderedList = true;
            else         inUnorderedList = true;
        };

        for (const auto& line : lines) {
            // ---- 代码块围栏 ----
            if (line.size() >= 3 && line.compare(0, 3, "```") == 0) {
                if (inCodeBlock) {
                    html += "<pre><code class=\"language-" + codeBlockLang + "\">"
                          + escapeHtml(codeBlockContent) + "</code></pre>\n";
                    codeBlockContent.clear();
                    codeBlockLang.clear();
                    inCodeBlock = false;
                } else {
                    flushParagraph();
                    flushList();
                    codeBlockLang = trim(line.substr(3));
                    inCodeBlock = true;
                }
                continue;
            }
            if (inCodeBlock) {
                if (!codeBlockContent.empty()) codeBlockContent += '\n';
                codeBlockContent += line;
                continue;
            }

            // ---- 表格（连续的 | 行）----
            const std::string trimmed = trim(line);
            if (!trimmed.empty() && trimmed.front() == '|' && trimmed.back() == '|') {
                flushParagraph();
                flushList();
                if (!inTable) { inTable = true; tableLines.clear(); }
                tableLines.push_back(line);
                continue;
            }
            if (inTable) {
                html += parseTable(tableLines);
                tableLines.clear();
                inTable = false;
            }

            // ---- 标题（带锚点 ID，供 TOC 跳转）----
            std::smatch m;
            if (std::regex_match(line, m, hRe)) {
                const int level = static_cast<int>(m[1].str().size());
                const std::string text = m[2].str();
                const std::string anchorId = makeAnchorId(text);
                flushParagraph();
                flushList();
                html += "<h" + std::to_string(level) + " id=\"" + anchorId + "\">"
                      + parseInline(text)
                      + "</h" + std::to_string(level) + ">\n";
                continue;
            }

            // ---- 水平线 ----
            if (!trimmed.empty() && std::regex_match(trimmed, hrRe)) {
                flushParagraph();
                flushList();
                html += "<hr>\n";
                continue;
            }

            // ---- 引用 ----
            if (std::regex_match(line, m, quoteRe)) {
                flushParagraph();
                flushList();
                html += "<blockquote><p>" + parseInline(m[1].str()) + "</p></blockquote>\n";
                continue;
            }

            // ---- GFM 任务列表（必须先于普通无序列表匹配）----
            if (std::regex_match(line, m, taskRe)) {
                const bool checked = !trim(m[1].str()).empty();
                startList(false);
                listItems.push_back(
                    std::string("<input type=\"checkbox\" disabled")
                    + (checked ? " checked" : "") + "> " + parseInline(m[2].str()));
                continue;
            }

            // ---- 无序列表 ----
            if (std::regex_match(line, m, ulRe)) {
                startList(false);
                listItems.push_back(parseInline(m[1].str()));
                continue;
            }

            // ---- 有序列表 ----
            if (std::regex_match(line, m, olRe)) {
                startList(true);
                listItems.push_back(parseInline(m[1].str()));
                continue;
            }

            // ---- 空行：段落分隔，同时关闭列表 ----
            if (trimmed.empty()) {
                flushParagraph();
                flushList();
                continue;
            }

            // ---- 普通段落 ----
            if (inUnorderedList || inOrderedList) flushList();
            paragraph.push_back(line);
        }

        // 收尾：未闭合的块
        if (inTable) html += parseTable(tableLines);
        flushList();
        flushParagraph();

        return html;
    }

    const char* name() const noexcept override { return "simple"; }
};

} // namespace

std::unique_ptr<IMarkdownParser> makeSimpleParser()
{
    return std::make_unique<SimpleParser>();
}

} // namespace covemd
