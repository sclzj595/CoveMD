#ifndef COVEMD_MARKDOWN_PARSER_H
#define COVEMD_MARKDOWN_PARSER_H

/// CoveMD Markdown 解析核心（纯 C++17，无 Qt / 无 Node 依赖）
///
/// 约定：
/// - 输入输出均为 UTF-8 编码的 std::string
/// - 输出为 body-only HTML 片段：不含 <html>/<head>/<style> 外壳
///   （主题样式、代码高亮、mermaid 渲染均由上层 Webview 负责）
/// - 一处编写，两处复用：Qt 宿主（SoulCove）与 Node-API 宿主（VSCode 插件）

#include <memory>
#include <string>

namespace covemd {

/// Markdown 解析器抽象接口（原 IMarkdownParser 的 STL 版）
class IMarkdownParser
{
public:
    virtual ~IMarkdownParser() = default;

    /// 将 Markdown（UTF-8）转换为 HTML 片段（UTF-8, body-only）
    virtual std::string toHtml(const std::string& markdown) = 0;

    /// 解析器名称（用于日志/调试）
    virtual const char* name() const noexcept = 0;
};

/// 工厂：kind = "maddy"（默认，三方 MIT 库，GFM 支持较全）
///        kind = "simple"（自研轻量实现，零三方依赖）
std::unique_ptr<IMarkdownParser> createParser(const std::string& kind = "maddy");

/// 便捷入口：默认解析器一行调用
inline std::string markdown_to_html(const std::string& utf8_markdown)
{
    return createParser()->toHtml(utf8_markdown);
}

} // namespace covemd

#endif // COVEMD_MARKDOWN_PARSER_H
