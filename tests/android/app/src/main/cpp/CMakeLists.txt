cmake_minimum_required(VERSION 3.18)
project(jscbridge)

add_library(jscbridge SHARED jsc_bridge.cpp)

# Include JavaScriptCore headers from vendored directory
include_directories("${CMAKE_SOURCE_DIR}")

# Find libjsc.so from jniLibs (populated by extractJscLibraries Gradle task)
add_library(jsc SHARED IMPORTED)
set_target_properties(jsc PROPERTIES IMPORTED_LOCATION "${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libjsc.so")

find_library(log-lib log)
find_library(android-lib android)

# Link bridge against libjsc and standard Android libs
target_link_libraries(jscbridge jsc ${log-lib} ${android-lib} c++_shared)
