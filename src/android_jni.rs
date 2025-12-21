use crate::{TranspileOptions, transpile_jsx_with_options, version};
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::jstring;

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
    mut env: JNIEnv,
    _class: JClass,
    code: JString,
    filename: JString,
) -> jstring {
    let source = match jstring_to_string(&mut env, code) {
        Some(val) => val,
        None => {
            let _ = env.throw_new(
                "java/lang/IllegalArgumentException",
                "code was null or malformed",
            );
            return std::ptr::null_mut();
        }
    };

    let file = jstring_to_string(&mut env, filename).unwrap_or_else(|| "module.tsx".to_string());
    let is_typescript = file.ends_with(".ts") || file.ends_with(".tsx") || file.ends_with(".jsx");

    let opts = TranspileOptions {
        is_typescript,
    };

    match transpile_jsx_with_options(&source, &opts) {
        Ok(output) => new_jstring(&mut env, &output),
        Err(err) => {
            let msg = format!("{}. Source: {}", err, source);
            let _ = env.throw_new("java/lang/RuntimeException", msg);
            std::ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_com_relay_client_RustTranspilerModule_nativeGetVersion(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    new_jstring(&mut env, version())
}
