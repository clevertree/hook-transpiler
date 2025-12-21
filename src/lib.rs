mod jsx_parser;

pub struct TranspileOptions {
    pub is_typescript: bool,
}

impl Default for TranspileOptions {
    fn default() -> Self {
        Self {
            is_typescript: false,
        }
    }
}

/// Returns the crate version
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Simple JSX to JS transpiler using custom parser
/// Outputs direct calls to __hook_jsx_runtime.jsx(...)
pub fn transpile_jsx_simple(source: &str) -> Result<String, String> {
    transpile_jsx_with_options(source, &TranspileOptions::default())
}

/// Transpile JSX with options (e.g. TypeScript support)
pub fn transpile_jsx_with_options(source: &str, opts: &TranspileOptions) -> Result<String, String> {
    jsx_parser::transpile_jsx(source, opts).map_err(|e| e.to_string())
}

// WASM bindings for client-web (feature = "wasm")
#[cfg(feature = "wasm")]
mod wasm_api;

#[cfg(feature = "android")]
mod android_jni;

mod ffi;
pub use ffi::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_jsx() {
        let input = "<div>Hello</div>";
        let output = transpile_jsx_simple(input).unwrap();
        assert!(output.contains("__hook_jsx_runtime.jsx"));
        assert!(output.contains("div"));
        assert!(output.contains("Hello"));
    }

    #[test]
    fn test_jsx_with_props() {
        let input = r#"<div className="test">Content</div>"#;
        let output = transpile_jsx_simple(input).unwrap();
        assert!(output.contains("className"));
        assert!(output.contains("test"));
    }

    #[test]
    fn test_self_closing() {
        let input = "<img src='test.jpg' />";
        let output = transpile_jsx_simple(input).unwrap();
        assert!(output.contains("img"));
        assert!(output.contains("src"));
    }
}
