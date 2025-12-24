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

#[cfg(target_vendor = "apple")]
mod ios_ffi;

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

    #[test]
    fn test_strings_with_reserved_keywords() {
        // Test that strings containing reserved keywords are properly transpiled
        // and not treated as code
        let input = r#"<p className="text-xs text-gray-500 mb-2">Select a theme for the application</p>"#;
        let output = transpile_jsx_simple(input).unwrap();
        
        // Should contain the className prop
        assert!(output.contains("className"));
        assert!(output.contains("text-xs text-gray-500 mb-2"));
        
        // Should contain the text content as a string
        assert!(output.contains("Select a theme for the application"));
        
        // Should not have "className" inside the text content treated as code
        assert!(output.contains("__hook_jsx_runtime.jsx"));
    }

    #[test]
    fn test_string_with_jsx_like_content() {
        // Test strings containing JSX-like syntax are preserved as strings
        let input = r#"<div>{"<div>test</div>"}</div>"#;
        let output = transpile_jsx_simple(input).unwrap();
        
        // The outer div should be transpiled
        assert!(output.contains("__hook_jsx_runtime.jsx"));
        assert!(output.contains("div"));
        
        // The inner JSX-like string should be preserved as a string
        assert!(output.contains("<div>test</div>"));
    }

    #[test]
    fn test_multiple_class_names() {
        // Test multiple space-separated class names with reserved keywords
        let input = r#"<button className="px-3 py-1 bg-blue-600 text-white rounded">Click me</button>"#;
        let output = transpile_jsx_simple(input).unwrap();
        
        assert!(output.contains("className"));
        assert!(output.contains("px-3 py-1 bg-blue-600 text-white rounded"));
        assert!(output.contains("Click me"));
    }

    #[test]
    fn test_full_test_hook_transpiles() {
        // Regression: ensure the web fixture hook transpiles without EOF errors
        let input = include_str!("../tests/web/public/hooks/test-hook.jsx");
        let output = transpile_jsx_simple(input);

        assert!(output.is_ok(), "test-hook.jsx should transpile: {output:?}");
    }

    #[test]
    fn test_reserved_keywords_in_jsx_text() {
        // Test that reserved keywords in JSX text content don't cause errors
        let input = r#"<p>This paragraph has reserved keywords like interface await default import export but should still render correctly.</p>"#;
        let output = transpile_jsx_simple(input).unwrap();
        
        // Should successfully transpile
        assert!(output.contains("__hook_jsx_runtime.jsx"));
        assert!(output.contains("p"));
        
        // Text content should be preserved
        assert!(output.contains("interface"));
        assert!(output.contains("await"));
        assert!(output.contains("default"));
        assert!(output.contains("import"));
        assert!(output.contains("export"));
    }
}
