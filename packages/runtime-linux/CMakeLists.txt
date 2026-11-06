cmake_minimum_required(VERSION 3.24)
project(8f4e-runtime-linux LANGUAGES CXX)

if(NOT CMAKE_SYSTEM_NAME STREQUAL "Linux")
  message(FATAL_ERROR "This runtime uses Linux ALSA. Build on Linux or in a Linux container.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/dist")
option(BUILD_TESTING "Build hardware-independent runtime tests" OFF)

find_package(ALSA REQUIRED)
find_package(Threads REQUIRED)
include(cmake/Wasmtime.cmake)

add_library(runtime-core src/program.cpp)
target_include_directories(runtime-core PUBLIC src)
target_link_libraries(runtime-core PUBLIC wasmtime)
target_compile_options(runtime-core PRIVATE -Wall -Wextra -Wpedantic)

add_executable(8f4e-runtime src/main.cpp)
target_link_libraries(8f4e-runtime PRIVATE runtime-core ALSA::ALSA)
target_compile_options(8f4e-runtime PRIVATE -Wall -Wextra -Wpedantic)

if(BUILD_TESTING)
  enable_testing()
  add_executable(runtime-tests tests/runtime-tests.cpp)
  target_link_libraries(runtime-tests PRIVATE runtime-core)
  target_compile_options(runtime-tests PRIVATE -Wall -Wextra -Wpedantic)
  add_test(NAME runtime-contract COMMAND sh "${CMAKE_CURRENT_SOURCE_DIR}/dist/tests/run-contract.sh")
  add_test(NAME alsa-null-output COMMAND sh "${CMAKE_CURRENT_SOURCE_DIR}/dist/tests/run-instrument.sh")
  add_test(NAME reject-named-buffer COMMAND 8f4e-runtime
    "${CMAKE_CURRENT_SOURCE_DIR}/dist/tests/instrument.wasm" --left output:left --audio-device null)
  set_tests_properties(reject-named-buffer PROPERTIES WILL_FAIL TRUE)
  add_test(NAME reject-buffer-outside-memory COMMAND 8f4e-runtime
    "${CMAKE_CURRENT_SOURCE_DIR}/dist/tests/instrument.wasm" --left 65536 --audio-device null)
  set_tests_properties(reject-buffer-outside-memory PROPERTIES WILL_FAIL TRUE)
endif()
