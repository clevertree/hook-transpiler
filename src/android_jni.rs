use crate::{TranspileOptions, transpile_jsx_with_options, version, DebugLevel};
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::{jstring, jboolean, jint};
use std::sync::Mutex;

thread_local! {
    static ANDROID_DEBUG_LEVEL: Mutex<DebugLevel> = Mutex::new(DebugLevel::default());
}

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

/// Set debug level for Android transpiler
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_relay_pure_RustTranspilerModule_nativeSetDebugLevel(
    _env: JNIEnv,
    _class: JClass,
    level: jint,
) -> jboolean {
    let debug_level = match level {
        0 => DebugLevel::Off,
        1 => DebugLevel::Error,
        2 => DebugLevel::Warn,
        3 => DebugLevel::Info,
        4 => DebugLevel::Trace,
        5 => DebugLevel::Verbose,
        _ => return 0,
    };
    
    ANDROID_DEBUG_LEVEL.with(|dl| {
        if let Ok(mut level_guard) = dl.lock() {
            *level_guard = debug_level;
            android_logger(format!("Debug level set to: {}", debug_level));
            1
        } else {
            0
        }
    })
}

/// Get current debug level for Android transpiler
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_relay_pure_RustTranspilerModule_nativeGetDebugLevel(
    _env: JNIEnv,
    _class: JClass,
) -> jint {
    ANDROID_DEBUG_LEVEL.with(|dl| {
        dl.lock()
            .map(|level| *level as jint)
            .unwrap_or(DebugLevel::default() as jint)
    })
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

    let filename = jstring_to_string(&mut env, filename).unwrap_or_else(|| "module.tsx".to_string());
    
    let debug_level = ANDROID_DEBUG_LEVEL.with(|dl| {
        dl.lock()
            .map(|level| *level)
            .unwrap_or(DebugLevel::default())
    });
    
    let opts = TranspileOptions {
        is_typescript: is_typescript != 0,
        target: crate::TranspileTarget::Android,
        filename: Some(filename.clone()),
        to_commonjs: true,
        source_maps: true,
        inline_source_map: true,
        compat_for_jsc: true,
        debug_level,
        ..Default::default()
    };

    let transpiled_res = transpile_jsx_with_options(&source, &opts);
    match transpiled_res {
        Ok(output) => {
            android_logger(format!("nativeTranspile: transpiled {} bytes (filename={})", output.len(), filename));
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
