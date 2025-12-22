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

    let opts = TranspileOptions { is_typescript };

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
