/*
 * This project is licensed under the MIT license. For more information see the
 * LICENSE file.
 */
#pragma once
// -----------------------------------------------------------------------------
#include <regex>
#include <string>
#include "maddy/lineparser.h"
namespace maddy {
class InlineCodeParser : public LineParser
{
public:
  // CoveMD 补丁 #4: 行内代码内容必须转义 HTML 特殊字符（对齐 codeblockparser 的 escapeXml 行为）。
  // 上游实现直接把 ` ` ` 捕获组拼进 <code>$1</code>，含 <script> 的行内代码会原样进入输出，
  // 浏览器将其解析为真实脚本标签（XSS 面 + 破坏宿主页面 DOM，CoveMD 插件真机踩实）。
  void Parse(std::string& line) override {
    static std::regex re("`([^`]*)`");
    std::sregex_iterator it(line.begin(), line.end(), re);
    if (it == std::sregex_iterator()) return;
    std::string out;
    std::smatch lastMatch;
    for (; it != std::sregex_iterator(); ++it) {
      out += it->prefix().str();
      out += "<code>" + escapeHtml((*it)[1].str()) + "</code>";
      lastMatch = *it;
    }
    out += lastMatch.suffix().str();
    line = out;
  }
private:
  static std::string escapeHtml(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 16);
    for (const char ch : s) {
      switch (ch) {
        case '&': out += "&amp;"; break;  // & 必须最先，避免二次转义
        case '<': out += "&lt;"; break;
        case '>': out += "&gt;"; break;
        case '"': out += "&quot;"; break;
        default:  out += ch; break;
      }
    }
    return out;
  }
};
} // namespace maddy