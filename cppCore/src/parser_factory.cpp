/// 解析器工厂
#include "parser_impl.h"

namespace covemd {

std::unique_ptr<IMarkdownParser> createParser(const std::string& kind)
{
    if (kind == "simple") return makeSimpleParser();
    return makeMaddyParser(); // 默认实现
}

} // namespace covemd
