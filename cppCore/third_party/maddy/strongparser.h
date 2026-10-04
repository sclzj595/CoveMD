/*
 * This project is licensed under the MIT license. For more information see the
 * LICENSE file.
 */
#pragma once
// -----------------------------------------------------------------------------
#include <string>
#include <regex>
#include "maddy/lineparser.h"
namespace maddy {
class StrongParser : public LineParser
{
public:
  void Parse(std::string& line) override {
    // 修复: 移除负向前瞻 (?!.*`.*|.*<code>.*)——该前瞻要求行内不含反引号，
    // 导致"同一行先加粗后写代码"时加粗失效；InlineCodeParser 已提前执行
    static std::vector<std::regex> res {
      std::regex{"\\*\\*([^*]+)\\*\\*"},
      std::regex{"__([^_]+)__"}
    };
    static std::string replacement = "<strong>$1</strong>";
    for (const auto& re : res)
      line = std::regex_replace(line, re, replacement);
  }
};
} // namespace maddy