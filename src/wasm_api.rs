use super::*;
use serde::Serialize;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

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

#[wasm_bindgen]
pub fn transpile_jsx(source: &str, filename: &str, is_typescript: Option<bool>) -> JsValue {
    let is_typescript = is_typescript.unwrap_or_else(|| {
        filename.ends_with(".ts") || filename.ends_with(".tsx")
    });
    let opts = TranspileOptions { is_typescript };
    
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
    let opts = TranspileOptions { is_typescript };
    
    let result = match crate::jsx_parser::transpile_jsx_with_metadata(source, &opts) {
        Ok((code, metadata)) => WasmTranspileResultWithMetadata {
            code: Some(code),
            metadata: Some(metadata),
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
