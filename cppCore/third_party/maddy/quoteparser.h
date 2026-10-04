/*
 * This project is licensed under the MIT license. For more information see the
 * LICENSE file.
 */
#pragma once
// -----------------------------------------------------------------------------
#include <algorithm>
#include <functional>
#include <regex>
#include <string>
#include "maddy/blockparser.h"
namespace maddy {
class QuoteParser : public BlockParser
{
public:
  QuoteParser(std::function<void(std::string&)> parseLineCallback,
    std::function<std::shared_ptr<BlockParser>(const std::string& line)> getBlockParserForLineCallback)
    : BlockParser(parseLineCallback, getBlockParserForLineCallback), isStarted(false), isFinished(false), isCallout(false), isCollapsed(false) {}
  static bool IsStartingLine(const std::string& line) {
    static std::regex re("^\\>.*");
    return std::regex_match(line, re);
  }
  void AddLine(std::string& line) override {
    if (!this->isStarted) {
      this->isStarted = true;
      // CoveMD callout patch: GFM 风格提示块 "> [!TYPE]"（TYPE ∈ NOTE/TIP/IMPORTANT/WARNING/CAUTION，
      // 可选 +/- 控制折叠；输出 <details open><summary class="callout-title">，标题行就地消费）
      if (this->tryStartCallout(line)) return;
      this->result << "<blockquote>";
    }
    bool finish = false;
    if (line.empty()) finish = true;
    this->parseBlock(line);
    if (this->isInlineBlockAllowed() && !this->childParser)
      this->childParser = this->getBlockParserForLine(line);
    if (this->childParser) {
      this->childParser->AddLine(line);
      if (this->childParser->IsFinished()) {
        this->result << this->childParser->GetResult().str();
        this->childParser = nullptr;
      }
      // 修复: 空行已交给子解析器收尾，不再作为正文追加
    } else {
      if (this->isLineParserAllowed()) this->parseLine(line);
      if (!finish) this->result << line;
    }
    // 修复: 收尾必须无条件执行——原实现放在子分支 return 之后，
    // 导致引用块永远无法闭合并吞掉文档剩余内容
    if (finish) {
      // CoveMD callout patch: 容器收尾按类型分流
      this->result << (this->isCallout ? "</details>" : "</blockquote>");
      this->isFinished = true;
    }
  }
  bool IsFinished() const override { return this->isFinished; }
protected:
  bool isInlineBlockAllowed() const override { return true; }
  bool isLineParserAllowed() const override { return true; }
  void parseBlock(std::string& line) override {
    static std::regex lineRegexWithSpace("^\\> ");
    line = std::regex_replace(line, lineRegexWithSpace, "");
    static std::regex lineRegexWithoutSpace("^\\>");
    line = std::regex_replace(line, lineRegexWithoutSpace, "");
    if (!line.empty()) line += " ";
  }
private:
  bool isStarted; bool isFinished;
  bool isCallout; bool isCollapsed;
  // CoveMD callout patch: 检测首行 [!TYPE]，命中则开启 callout 容器并消费标题行
  bool tryStartCallout(const std::string& rawLine) {
    static std::regex withSpace("^\\> "), withoutSpace("^\\>");
    std::string probe = std::regex_replace(rawLine, withSpace, "");
    probe = std::regex_replace(probe, withoutSpace, "");
    static std::regex calloutRe("^\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\\]([+-])?[ \\t]*(.*)$");
    std::smatch m;
    if (!std::regex_match(probe, m, calloutRe)) return false;
    this->isCallout = true;
    this->isCollapsed = (m[2].str() == "-");
    const std::string type = m[1].str();
    std::string lower = type;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    std::string titleText = m[3].str();
    this->result << "<details class=\"callout callout-" << lower << "\""
                 << (this->isCollapsed ? "" : " open") << ">";
    this->result << "<summary class=\"callout-title\">" << type;
    if (!titleText.empty()) this->result << ": " << titleText;
    this->result << "</summary>";
    return true;
  }
};
} // namespace maddy