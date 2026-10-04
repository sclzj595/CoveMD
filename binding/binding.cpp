// CoveMD Node-API 绑定层（薄封装）
// 职责边界：只做 JS 字符串 <-> std::string(UTF-8) 互转、解析器实例缓存与调用分发，
// 全部业务逻辑在 cppCore（covemd::IMarkdownParser）。适配层禁止出现解析逻辑。
//
// 线程约定：当前仅同步接口，调用发生在 JS 主线程；解析器缓存用互斥锁保护，
// 为将来增加异步接口（napi_create_async_work 线程池调用）预留线程安全。
// 异常约定：JS 异常用 ThrowAsJavaScriptException 显式抛出，C++ 异常不跨 NAPI 边界。
#include <napi.h>

#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

#include "covemd/markdown_parser.h"

namespace {

std::mutex g_parsersMutex;

// 解析器实例缓存：maddy::Parser 构造成本不为零（内部构建行内解析器），
// 按 kind 缓存复用，避免每次调用重建
std::unordered_map<std::string, std::unique_ptr<covemd::IMarkdownParser>>& parserCache()
{
    static std::unordered_map<std::string, std::unique_ptr<covemd::IMarkdownParser>> cache;
    return cache;
}

// parse(markdown: string, kind?: "maddy" | "simple") => string(html)
Napi::Value Parse(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "parse(markdown: string, kind?: string): markdown must be a string")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string kind = "maddy";
    if (info.Length() >= 2 && !info[1].IsUndefined() && !info[1].IsNull()) {
        if (!info[1].IsString()) {
            Napi::TypeError::New(env, "kind must be a string ('maddy' | 'simple')")
                .ThrowAsJavaScriptException();
            return env.Null();
        }
        kind = info[1].As<Napi::String>().Utf8Value();
    }

    const std::string markdown = info[0].As<Napi::String>().Utf8Value();

    std::string html;
    {
        std::lock_guard<std::mutex> lock(g_parsersMutex);
        auto& cache = parserCache();
        auto it = cache.find(kind);
        if (it == cache.end()) {
            // 未知 kind 由工厂回退到默认实现
            it = cache.emplace(kind, covemd::createParser(kind)).first;
        }
        try {
            html = it->second->toHtml(markdown);
        } catch (const std::exception& e) {
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
            return env.Null();
        }
    }

    return Napi::String::New(env, html);
}

Napi::Object InitModule(Napi::Env env, Napi::Object exports)
{
    exports.Set("parse", Napi::Function::New(env, Parse));
    exports.Set("version", Napi::String::New(env, COVEMD_NATIVE_VERSION));
    return exports;
}

} // namespace

NODE_API_MODULE(covemd_native, InitModule)
