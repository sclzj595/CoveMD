cmake_minimum_required(VERSION 3.15)
# cmake-js 构建：CMAKE_JS_INC(node头)/CMAKE_JS_SRC(delay-load hook)/CMAKE_JS_LIB(node.lib)
# 由 cmake-js 注入；本工程可脱离 cmake-js 手工构建（需自备 node 头文件路径）
project(covemd_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# 复用 cppCore 静态库；其 demo 可执行文件与 binding 无关，关闭
set(COVEMD_BUILD_DEMO OFF CACHE BOOL "" FORCE)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../cppCore ${CMAKE_BINARY_DIR}/cppCore-build)

add_library(covemd_native SHARED binding.cpp ${CMAKE_JS_SRC})
set_target_properties(covemd_native PROPERTIES PREFIX "" SUFFIX ".node")

target_include_directories(covemd_native PRIVATE
    ${CMAKE_JS_INC}
    # napi.h（NODE_API_MODULE 宏）来自 node-addon-api，纯头文件、零运行时开销
    ${CMAKE_CURRENT_SOURCE_DIR}/node_modules/node-addon-api
)
target_compile_definitions(covemd_native PRIVATE
    COVEMD_NATIVE_VERSION="0.1.0"
    NOMINMAX
    WIN32_LEAN_AND_MEAN
)
if(MSVC)
    target_compile_options(covemd_native PRIVATE /utf-8 /W4)
else()
    target_compile_options(covemd_native PRIVATE -Wall -Wextra)
endif()
# MinGW 产物静态链接运行库：.node 将被官方 MSVC 版 node.exe 加载，
# 不得出现对本机 libstdc++/libgcc/winpthread DLL 的运行时依赖
if(MINGW)
    # cmake-js 注入的是 MSVC 风格链接参数，MinGW ld 不认识：
    # ① /DELAYLOAD:NODE.EXE（MSVC delayimp 语法）→ 剥除
    string(REPLACE "/DELAYLOAD:NODE.EXE" "" CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS}")
    # ② node.lib 为反斜杠路径，ld 会把 \ 当转义 → 转正斜杠
    file(TO_CMAKE_PATH "${CMAKE_JS_LIB}" NODE_LIB_NATIVE)
    target_link_libraries(covemd_native PRIVATE covemd_core "${NODE_LIB_NATIVE}")
    target_link_options(covemd_native PRIVATE -static-libgcc -static-libstdc++)
else()
    target_link_libraries(covemd_native PRIVATE covemd_core ${CMAKE_JS_LIB})
endif()
