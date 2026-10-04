#ifndef COVEMD_PARSER_IMPL_H
#define COVEMD_PARSER_IMPL_H

/// 内部头文件：各实现的工厂函数声明（不进入公开 API）
#include "covemd/markdown_parser.h"

namespace covemd {

std::unique_ptr<IMarkdownParser> makeMaddyParser();
std::unique_ptr<IMarkdownParser> makeSimpleParser();

} // namespace covemd

#endif // COVEMD_PARSER_IMPL_H
