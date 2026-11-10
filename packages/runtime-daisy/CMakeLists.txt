cmake_minimum_required(VERSION 3.20)
project(wamr_daisy LANGUAGES C ASM)

set(WAMR_ROOT_DIR "$ENV{WAMR_DIR}" CACHE PATH "Path to WAMR 2.4.5 sources")
if(NOT EXISTS "${WAMR_ROOT_DIR}/build-scripts/runtime_lib.cmake")
  message(FATAL_ERROR "Set WAMR_DIR to the WAMR 2.4.5 source directory")
endif()

set(WAMR_BUILD_PLATFORM "daisy")
set(SHARED_PLATFORM_CONFIG "${CMAKE_CURRENT_SOURCE_DIR}/cmake/wamr-platform.cmake")
set(WAMR_BUILD_TARGET "THUMBV7EM_VFP")
set(WAMR_BUILD_AOT 1)
set(WAMR_BUILD_INTERP 0)
set(WAMR_BUILD_JIT 0)
set(WAMR_BUILD_FAST_JIT 0)
set(WAMR_BUILD_LIBC_BUILTIN 0)
set(WAMR_BUILD_LIBC_WASI 0)
set(WAMR_BUILD_SHARED_MEMORY 1)
set(WAMR_BUILD_BULK_MEMORY 1)
set(WAMR_BUILD_SIMD 0)
set(WAMR_BUILD_THREAD_MGR 0)
set(WAMR_DISABLE_HW_BOUND_CHECK 1)
set(WAMR_DISABLE_WAKEUP_BLOCKING_OP 1)
include("${WAMR_ROOT_DIR}/build-scripts/runtime_lib.cmake")

# LLVM lowers zero fills to a newlib helper missing from WAMR 2.4.5's Thumb
# relocation table. Extend the generated copy without changing the dependency.
set(thumb_source "${WAMR_ROOT_DIR}/core/iwasm/aot/arch/aot_reloc_thumb.c")
file(READ "${thumb_source}" thumb_relocations)
string(FIND "${thumb_relocations}" "REG_SYM(__aeabi_d2f)," relocation_anchor)
if(relocation_anchor EQUAL -1)
  message(FATAL_ERROR "Unexpected Thumb relocation table in WAMR source")
endif()
string(REPLACE "void __aeabi_d2f(void);"
  "void __aeabi_memclr(void *dest, size_t count);\nvoid __aeabi_d2f(void);"
  thumb_relocations "${thumb_relocations}")
string(REPLACE "REG_SYM(__aeabi_d2f),"
  "REG_SYM(__aeabi_memclr),\n    REG_SYM(__aeabi_d2f),"
  thumb_relocations "${thumb_relocations}")
set(daisy_thumb_source "${CMAKE_CURRENT_BINARY_DIR}/aot_reloc_thumb.c")
file(CONFIGURE OUTPUT "${daisy_thumb_source}" CONTENT "${thumb_relocations}" @ONLY)
list(REMOVE_ITEM WAMR_RUNTIME_LIB_SOURCE "${thumb_source}")
list(APPEND WAMR_RUNTIME_LIB_SOURCE "${daisy_thumb_source}")
add_library(vmlib STATIC ${WAMR_RUNTIME_LIB_SOURCE})
