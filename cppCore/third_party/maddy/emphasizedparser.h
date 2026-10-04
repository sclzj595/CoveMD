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
class EmphasizedParser : public LineParser
{
public:
  void Parse(std::string& line) override {
    // 修复: 移除负向前瞻（理由见 strongparser.h）
    static std::regex re("_([^_]+)_");
    static std::string replacement = "<em>$1</em>";
    line = std::regex_replace(line, re, replacement);
  }
};
} // namespace maddy