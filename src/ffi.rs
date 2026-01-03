use super::*;
use std::ffi::{CStr, CString, c_char};
use std::ptr;

#[unsafe(no_mangle)]
pub extern "C" fn hook_transpiler_version() -> *const c_char {
    static VERSION: &str = concat!(env!("CARGO_PKG_VERSION"), "\0");
    VERSION.as_ptr() as *const c_char
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn hook_transpile_jsx(
    code: *const c_char,
    _filename: *const c_char,
    is_typescript: bool,
) -> *mut c_char {
    if code.is_null() {
        return ptr::null_mut();
    }

    let code_str = match unsafe { CStr::from_ptr(code).to_str() } {
        Ok(s) => s,
        Err(_) => return ptr::null_mut(),
    };

    let opts = TranspileOptions {
        is_typescript,
        target: TranspileTarget::Android,
        filename: None,
        to_commonjs: true,
        source_maps: false,
        inline_source_map: false,
        compat_for_jsc: true,
        debug_level: DebugLevel::default(),
    };

    match transpile_jsx_with_options(code_str, &opts) {
        Ok(transpiled) => {
            match CString::new(transpiled) {
                Ok(c_str) => c_str.into_raw(),
                Err(_) => ptr::null_mut(),
            }
        }
        Err(_) => ptr::null_mut(),
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn hook_transpiler_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe { drop(CString::from_raw(s)) };
    }
}
