use super::*;
use serde::Serialize;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;
use std::sync::Mutex;

#[derive(Serialize)]
struct WasmTranspileResult {
    code: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct WasmTranspileResultWithMetadata {
    code: Option<String>,
    metadata: Option<crate::TranspileMetadata>,
    error: Option<String>,
}

#[derive(Serialize)]
struct WasmDebugInfo {
    logs: Vec<DebugEntry>,
    formatted: String,
}

// Thread-local debug context for WASM
thread_local! {
    static WASM_DEBUG_LEVEL: Mutex<DebugLevel> = Mutex::new(DebugLevel::default());
}

#[wasm_bindgen]
pub fn set_debug_level(level: &str) -> bool {
    match level.parse::<DebugLevel>() {
        Ok(debug_level) => {
            WASM_DEBUG_LEVEL.with(|dl| {
                if let Ok(mut level_guard) = dl.lock() {
                    *level_guard = debug_level;
                    true
                } else {
                    false
                }
            })
        }
        Err(_) => false,
    }
}

#[wasm_bindgen]
pub fn get_debug_level() -> String {
    WASM_DEBUG_LEVEL.with(|dl| {
        dl.lock()
            .map(|level| level.to_string())
            .unwrap_or_else(|_| "unknown".to_string())
    })
}

#[wasm_bindgen]
pub fn transpile_jsx(source: &str, filename: &str, is_typescript: Option<bool>) -> JsValue {
    let is_typescript = is_typescript.unwrap_or_else(|| {
        filename.ends_with(".ts") || filename.ends_with(".tsx")
    });
    
    let debug_level = WASM_DEBUG_LEVEL.with(|dl| {
        dl.lock()
            .map(|level| *level)
            .unwrap_or(DebugLevel::default())
    });
    
    let opts = TranspileOptions {
        is_typescript,
        target: TranspileTarget::Web,  // Web browsers support modern JS
        filename: Some(filename.to_string()),
        source_maps: false,
        inline_source_map: false,
        compat_for_jsc: false,
        debug_level,
        ..Default::default()
    };
    
    let result = match transpile_jsx_with_options(source, &opts) {
        Ok(code) => WasmTranspileResult {
            code: Some(code),
            error: None,
        },
        Err(err) => WasmTranspileResult {
            code: None,
            error: Some(err.to_string()),
        },
    };
    to_value(&result)
        .unwrap_or_else(|err| JsValue::from_str(&format!("serde-wasm-bindgen error: {err}")))
}

#[wasm_bindgen]
pub fn get_version() -> String {
    version().to_string()
}

#[wasm_bindgen]
pub fn transpile_jsx_with_metadata(source: &str, filename: &str, is_typescript: Option<bool>) -> JsValue {
    let is_typescript = is_typescript.unwrap_or_else(|| {
        filename.ends_with(".ts") || filename.ends_with(".tsx")
    });
    
    let result = match crate::transpile_jsx_with_metadata(source, Some(filename), is_typescript) {
        Ok(transpile_result) => WasmTranspileResultWithMetadata {
            code: Some(transpile_result.code),
            metadata: Some(transpile_result.metadata),
            error: None,
        },
        Err(err) => WasmTranspileResultWithMetadata {
            code: None,
            metadata: None,
            error: Some(err.to_string()),
        },
    };
    to_value(&result)
        .unwrap_or_else(|err| JsValue::from_str(&format!("serde-wasm-bindgen error: {err}")))
}

#[wasm_bindgen]
pub fn run_self_test() -> JsValue {
    let test_cases = vec![
        ("<div>Hello</div>", "div"),
        ("<img src='test.jpg' />", "img"),
        ("<Comp prop={1}>child</Comp>", "Comp"),
    ];

    let mut results = Vec::new();
    for (source, expected) in test_cases {
        let res = transpile_jsx_simple(source);
        results.push(match res {
            Ok(code) => {
                if code.contains(expected) && code.contains("__hook_jsx_runtime") {
                    format!("PASS: {}", expected)
                } else {
                    format!("FAIL: {} - output: {}", expected, code)
                }
            }
            Err(err) => format!("ERROR: {} - {}", expected, err),
        });
    }

    to_value(&results).unwrap()
}
