cmake_minimum_required(VERSION 3.18)
project(hook_transpiler_android)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find and configure JNI
find_package(JNI REQUIRED)

# Add source files
set(SOURCES
    src/main/cpp/hook_transpiler_jni.cpp
)

# Create the shared library
add_library(relay_hook_transpiler SHARED ${SOURCES})

# Include directories
target_include_directories(relay_hook_transpiler PRIVATE
    ${JNI_INCLUDE_DIRS}
    ${CMAKE_CURRENT_SOURCE_DIR}/src/main/cpp
)

# Link against JNI
target_link_libraries(relay_hook_transpiler PRIVATE
    ${JNI_LIBRARIES}
)

# For Rust FFI
# Uncomment if using Rust transpiler
# add_library(relay_hook_transpiler_rust STATIC IMPORTED)
# set_target_properties(relay_hook_transpiler_rust PROPERTIES
#     IMPORTED_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/src/main/rust/target/release/librelay_hook_transpiler.a"
# )
# target_link_libraries(relay_hook_transpiler PRIVATE relay_hook_transpiler_rust)

# Compiler flags
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    target_compile_options(relay_hook_transpiler PRIVATE -O3)
else()
    target_compile_options(relay_hook_transpiler PRIVATE -g)
endif()

# Platform-specific settings
if(ANDROID)
    target_compile_options(relay_hook_transpiler PRIVATE -fPIC)
endif()
