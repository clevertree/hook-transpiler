use crate::{transpile_jsx_with_options, TranspileOptions, TranspileTarget, version, DebugLevel};
use std::sync::Mutex;

thread_local! {
    static IOS_DEBUG_LEVEL: Mutex<DebugLevel> = Mutex::new(DebugLevel::default());
}

/// Set debug level for iOS transpiler
#[no_mangle]
pub extern "C" fn hook_transpiler_set_debug_level(level: u8) -> bool {
    let debug_level = match level {
        0 => DebugLevel::Off,
        1 => DebugLevel::Error,
        2 => DebugLevel::Warn,
        3 => DebugLevel::Info,
        4 => DebugLevel::Trace,
        5 => DebugLevel::Verbose,
        _ => return false,
    };
    
    IOS_DEBUG_LEVEL.with(|dl| {
        if let Ok(mut level_guard) = dl.lock() {
            *level_guard = debug_level;
            true
        } else {
            false
        }
    })
}

/// Get current debug level for iOS transpiler
#[no_mangle]
pub extern "C" fn hook_transpiler_get_debug_level() -> u8 {
    IOS_DEBUG_LEVEL.with(|dl| {
        dl.lock()
            .map(|level| *level as u8)
            .unwrap_or(DebugLevel::default() as u8)
    })
}

/// Free a string allocated by Rust
#[no_mangle]
pub unsafe extern "C" fn hook_transpiler_free_string(s: *mut std::os::raw::c_char) {
    if !s.is_null() {
        drop(std::ffi::CString::from_raw(s));
    }
}

/// Transpile TypeScript/JSX code
#[no_mangle]
pub extern "C" fn hook_transpiler_transpile(
    code_ptr: *const u8,
    code_len: usize,
    filename_ptr: *const u8,
    filename_len: usize,
) -> *mut std::os::raw::c_char {
    let code = unsafe {
        let slice = std::slice::from_raw_parts(code_ptr, code_len);
        String::from_utf8_lossy(slice).into_owned()
    };

    let filename = unsafe {
        let slice = std::slice::from_raw_parts(filename_ptr, filename_len);
        String::from_utf8_lossy(slice).into_owned()
    };

    let debug_level = IOS_DEBUG_LEVEL.with(|dl| {
        dl.lock()
            .map(|level| *level)
            .unwrap_or(DebugLevel::default())
    });

    let opts = TranspileOptions {
        is_typescript: filename.ends_with(".ts") || filename.ends_with(".tsx"),
        target: TranspileTarget::Android,
        filename: Some(filename),
        to_commonjs: true,
        source_maps: false,
        inline_source_map: false,
        compat_for_jsc: true,
        debug_level,
        ..Default::default()
    };

    match transpile_jsx_with_options(&code, &opts) {
        Ok(output) => match std::ffi::CString::new(output) {
            Ok(c_str) => c_str.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Get version string
#[no_mangle]
pub extern "C" fn hook_transpiler_version() -> *mut std::os::raw::c_char {
    match std::ffi::CString::new(version()) {
        Ok(c_str) => c_str.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}
