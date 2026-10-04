/// maddy 实现适配层：三方 header-only 解析器（MIT License）
/// https://github.com/progsource/maddy
///
/// 与旧版（SoulCove Qt 版）的差异：
/// - QString → std::string（UTF-8 直通，Node-API 侧无需二次转换）
/// - 移除代码高亮（CodeHighlighter）：由 Webview 层 highlight.js 负责
/// - 移除 mermaid 渲染（MermaidRenderer/mmdc 子进程）：由 Webview 层 mermaid.js 负责
/// - 移除主题 CSS（ThemeManager）：输出 body-only HTML，样式由 Webview 负责
#include "parser_impl.h"

#include <maddy/parser.h>
#include <sstream>

namespace covemd {
namespace {

class MaddyParser final : public IMarkdownParser
{
public:
    std::string toHtml(const std::string& markdown) override
    {
        if (markdown.empty()) return {};
        // CRLF 归一化：maddy 以 '\n' 分行，行尾残留 '\r' 会导致
        // 空行判断失效（段落吞块）且被 BreakLineParser 转成 <br>
        std::string normalized;
        normalized.reserve(markdown.size());
        for (size_t i = 0; i < markdown.size(); ++i) {
            if (markdown[i] == '\r') {
                if (i + 1 < markdown.size() && markdown[i + 1] == '\n') continue; // \r\n 跳过 \r
                normalized += '\n';                                               // 孤立 \r 转 \n
            } else {
                normalized += markdown[i];
            }
        }
        std::istringstream in(normalized);
        maddy::Parser parser;
        return parser.Parse(in);
    }

    const char* name() const noexcept override { return "maddy"; }
};

} // namespace

std::unique_ptr<IMarkdownParser> makeMaddyParser()
{
    return std::make_unique<MaddyParser>();
}

} // namespace covemd
