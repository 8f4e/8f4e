# A supplied Wasmtime C API distribution avoids network access at configure time.
set(WASMTIME_ROOT "" CACHE PATH "Extracted Wasmtime C API distribution")
if(NOT WASMTIME_ROOT)
  include(FetchContent)
  if(CMAKE_SYSTEM_PROCESSOR MATCHES "^(aarch64|arm64)$")
    set(wasmtime_arch aarch64)
    set(wasmtime_sha256 1a36140a016a9cc098f02a37bb0cc7be6451032861ba70049127928d2f31ef84)
  elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "^(x86_64|AMD64)$")
    set(wasmtime_arch x86_64)
    set(wasmtime_sha256 e2c0c26e1aef52f82f0b9918ad6f34cc30f4b557aee3e261cb127a9462be8f4d)
  else()
    message(FATAL_ERROR "Automatic Wasmtime downloads support 64-bit ARM and x86 Linux. Set WASMTIME_ROOT for another target.")
  endif()
  FetchContent_Declare(wasmtime_distribution
    URL "https://github.com/bytecodealliance/wasmtime/releases/download/v50.0.1/wasmtime-v50.0.1-${wasmtime_arch}-linux-c-api.tar.xz"
    URL_HASH "SHA256=${wasmtime_sha256}"
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
  FetchContent_MakeAvailable(wasmtime_distribution)
  set(WASMTIME_ROOT "${wasmtime_distribution_SOURCE_DIR}")
endif()

add_library(wasmtime STATIC IMPORTED)
set_target_properties(wasmtime PROPERTIES
  IMPORTED_LOCATION "${WASMTIME_ROOT}/lib/libwasmtime.a"
  INTERFACE_INCLUDE_DIRECTORIES "${WASMTIME_ROOT}/include"
  INTERFACE_LINK_LIBRARIES "Threads::Threads;${CMAKE_DL_LIBS};m")
