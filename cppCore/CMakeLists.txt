cmake_minimum_required(VERSION 3.16)
project(CoveMDCore LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ============ 核心：纯 C++17 静态库（零 Qt / 零 Boost / 零 Node 依赖） ============
add_library(covemd_core STATIC
    src/maddy_parser.cpp
    src/simple_parser.cpp
    src/parser_factory.cpp
)
target_include_directories(covemd_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)
# maddy 以 <maddy/xxx.h> 引用，third_party 根目录必须在 include 路径上；
# 标记为 SYSTEM：三方头文件不参与本库的 -Wall -Wextra 告警
target_include_directories(covemd_core SYSTEM PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

if(MSVC)
    target_compile_options(covemd_core PRIVATE /utf-8 /W4)
else()
    target_compile_options(covemd_core PRIVATE -Wall -Wextra)
endif()

# ============ 命令行 demo（编译验证 + 手动验收） ============
# 作为子工程被 binding/ 复用时关闭（COVEMD_BUILD_DEMO=OFF）
option(COVEMD_BUILD_DEMO "Build covemd_demo CLI" ON)
if(COVEMD_BUILD_DEMO)
    add_executable(covemd_demo demo/main.cpp)
    target_link_libraries(covemd_demo PRIVATE covemd_core)

    if(MSVC)
        target_compile_options(covemd_demo PRIVATE /utf-8)
    endif()
endif()
