#pragma once

#include <cstddef>
#include <cstdint>

struct PatchConfig {
    std::uint32_t left;
    std::uint32_t right;
    std::uint32_t frames;
};

namespace patch_config {
inline bool readValue(const char*& cursor, const char* end, const char* key, std::uint32_t& value) {
    for (; *key; ++key) {
        if (cursor == end || *cursor++ != *key) return false;
    }
    if (cursor == end || *cursor < '0' || *cursor > '9') return false;
    value = 0;
    do {
        const auto digit = static_cast<std::uint32_t>(*cursor++ - '0');
        if (value > (UINT32_MAX - digit) / 10) return false;
        value = value * 10 + digit;
    } while (cursor != end && *cursor >= '0' && *cursor <= '9');
    return true;
}

inline bool readNewline(const char*& cursor, const char* end) {
    if (cursor != end && *cursor == '\r') ++cursor;
    return cursor != end && *cursor++ == '\n';
}

inline bool parse(const char* text, std::size_t size, PatchConfig& config) {
    const char* cursor = text;
    const char* end = text + size;
    if (!readValue(cursor, end, "left=", config.left) || !readNewline(cursor, end) ||
        !readValue(cursor, end, "right=", config.right) || !readNewline(cursor, end) ||
        !readValue(cursor, end, "frames=", config.frames)) return false;
    if (cursor != end && !readNewline(cursor, end)) return false;
    return cursor == end && config.left % 4 == 0 && config.right % 4 == 0 &&
           config.frames >= 1 && config.frames <= 256;
}
} // namespace patch_config
