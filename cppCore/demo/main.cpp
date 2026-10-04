/// CoveMD 解析核心最小 demo
/// 用法：covemd_demo [markdown文件] [maddy|simple]
/// 不传文件则读 stdin；不传解析器则默认 maddy
#include "covemd/markdown_parser.h"

#include <fstream>
#include <iostream>
#include <sstream>

int main(int argc, char** argv)
{
    std::string markdown;
    if (argc > 1) {
        std::ifstream file(argv[1], std::ios::binary);
        if (!file) {
            std::cerr << "无法打开文件: " << argv[1] << "\n";
            return 1;
        }
        std::ostringstream ss;
        ss << file.rdbuf();
        markdown = ss.str();
    } else {
        std::ostringstream ss;
        ss << std::cin.rdbuf();
        markdown = ss.str();
    }

    const std::string kind = (argc > 2) ? argv[2] : "maddy";
    auto parser = covemd::createParser(kind);
    std::cout << parser->toHtml(markdown);
    return 0;
}
