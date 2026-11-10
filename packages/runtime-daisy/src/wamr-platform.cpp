#include "daisy.h"
#include "platform_api_vmcore.h"
#include "platform_api_extension.h"

namespace {
// WAMR maps both relocated AOT text and guest linear memory into AXI SRAM.
alignas(4096) uint8_t mappedArena[128 * 1024];
size_t mappedUsed;
}

extern "C" {
extern uint8_t _estack;

int bh_platform_init(void) {
    mappedUsed = 0;
    return 0;
}

void bh_platform_destroy(void) {}

// The embedder supplies a fixed WAMR pool.
void* os_malloc(unsigned) { return nullptr; }
void* os_realloc(void*, unsigned) { return nullptr; }
void os_free(void*) {}

int os_printf(const char*, ...) { return 0; }
int os_vprintf(const char*, va_list) { return 0; }
uint64 os_time_get_boot_us(void) { return daisy::System::GetUs(); }
uint64 os_time_thread_cputime_us(void) { return os_time_get_boot_us(); }
korp_tid os_self_thread(void) { return 1; }
uint8* os_thread_get_stack_boundary(void) {
    return reinterpret_cast<uint8*>(reinterpret_cast<uintptr_t>(&_estack) - 32 * 1024);
}

// Loading and guest execution never overlap. Atomics can use shared memory,
// but this single-context port rejects waiting for another guest thread.
int os_mutex_init(korp_mutex*) { return 0; }
int os_mutex_destroy(korp_mutex*) { return 0; }
int os_mutex_lock(korp_mutex*) { return 0; }
int os_mutex_unlock(korp_mutex*) { return 0; }
int os_cond_init(korp_cond*) { return -1; }
int os_cond_destroy(korp_cond*) { return 0; }
int os_cond_signal(korp_cond*) { return -1; }
int os_cond_reltimedwait(korp_cond*, korp_mutex*, uint64) { return -1; }

void* os_mmap(void*, size_t size, int, int flags, os_file_handle file) {
    if (flags != MMAP_MAP_NONE || file != os_get_invalid_handle()) return nullptr;
    const size_t page = os_getpagesize();
    const size_t start = (mappedUsed + page - 1) & ~(page - 1);
    if (start > sizeof(mappedArena) || size > sizeof(mappedArena) - start) return nullptr;
    mappedUsed = start + size;
    memset(mappedArena + start, 0, size);
    return mappedArena + start;
}

void os_munmap(void*, size_t) {}
void* os_mremap(void*, size_t, size_t) { return nullptr; }
int os_mprotect(void*, size_t, int) { return 0; }
// The executable arena has no OS-managed per-thread write protection.
void os_thread_jit_write_protect_np(bool) {}
void os_dcache_flush(void) { SCB_CleanDCache(); }
void os_icache_flush(void*, size_t) { SCB_InvalidateICache(); }
}
