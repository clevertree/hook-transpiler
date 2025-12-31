use crate::{TranspileOptions, transpile_jsx_with_options, version};
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::{jstring, jboolean};

fn android_logger(msg: String) {
    let tag = std::ffi::CString::new("RustTranspiler").unwrap();
    let msg = std::ffi::CString::new(msg).unwrap();
    unsafe {
        __android_log_print(3, tag.as_ptr(), msg.as_ptr());
    }
}

unsafe extern "C" {
    fn __android_log_print(prio: i32, tag: *const libc::c_char, fmt: *const libc::c_char, ...);
}

fn jstring_to_string(env: &mut JNIEnv, input: JString) -> Option<String> {
    if input.is_null() {
        return None;
    }
    match env.get_string(&input) {
        Ok(jni_str) => jni_str.to_str().ok().map(|s| s.to_string()),
        Err(_) => None,
    }
}

fn new_jstring(env: &mut JNIEnv, value: &str) -> jstring {
    match env.new_string(value) {
        Ok(jstr) => jstr.into_raw(),
        Err(_) => {
            // If it fails, try returning an empty string
            match env.new_string("") {
                Ok(jstr) => jstr.into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
    }
}

/// JNI bridge exposed to Android (via RustTranspilerModule)
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_relay_client_RustTranspilerModule_nativeTranspile(
    env: JNIEnv,
    class: JClass,
    code: JString,
    filename: JString,
    is_typescript: jboolean,
) -> jstring {
    Java_com_relay_pure_RustTranspilerModule_nativeTranspile(env, class, code, filename, is_typescript)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_com_relay_pure_RustTranspilerModule_nativeTranspile(
    mut env: JNIEnv,
    _class: JClass,
    code: JString,
    filename: JString,
    is_typescript: jboolean,
) -> jstring {
    let source = match jstring_to_string(&mut env, code) {
        Some(val) => {
            android_logger(format!("nativeTranspile: source len = {}", val.len()));
            val
        },
        None => {
            let _ = env.throw_new(
                "java/lang/IllegalArgumentException",
                "code was null or malformed",
            );
            return std::ptr::null_mut();
        }
    };

    let _file = jstring_to_string(&mut env, filename).unwrap_or_else(|| "module.tsx".to_string());
    
    let opts = TranspileOptions {
        is_typescript: is_typescript != 0,
    };

    // Step 1: Transform ES6 modules to CommonJS (import → require, export → module.exports)
    let commonjs_code = crate::jsx_parser::transform_es6_modules(&source);
    android_logger(format!("nativeTranspile: after module transform = {}", commonjs_code.len()));
    
    // Step 2: Transpile JSX syntax
    let transpiled_res = transpile_jsx_with_options(&commonjs_code, &opts);
    match transpiled_res {
        Ok(output) => {
            android_logger(format!("nativeTranspile: after JSX transform = {}", output.len()));
            new_jstring(&mut env, &output)
        },
        Err(err) => {
            let msg = format!("{}", err);
            android_logger(format!("nativeTranspile ERROR: {}", msg));
            let _ = env.throw_new("java/lang/RuntimeException", msg);
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_com_relay_client_RustTranspilerModule_nativeGetVersion(
    env: JNIEnv,
    class: JClass,
) -> jstring {
    Java_com_relay_pure_RustTranspilerModule_nativeGetVersion(env, class)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_com_relay_pure_RustTranspilerModule_nativeGetVersion(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    new_jstring(&mut env, version())
}
