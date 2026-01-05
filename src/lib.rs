mod jsx_parser;
mod swc_transformer;
pub mod debug;
#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
mod swc_native;

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};

pub use debug::{DebugLevel, DebugContext, DebugEntry};

/// Target platform for transpilation
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TranspileTarget {
    /// Web browser - supports modern ES2020+ features
    Web,
    /// Android JavaScriptCore - older JS engine, needs more transpilation
    Android,
}

impl Default for TranspileTarget {
    fn default() -> Self {
        Self::Web
    }
}

pub struct TranspileOptions {
    pub is_typescript: bool,
    /// Target platform - determines which features need transpilation
    pub target: TranspileTarget,
    /// Optional filename for diagnostics and SWC parser hints
    pub filename: Option<String>,
    /// Whether to emit CommonJS-compatible output (native targets only)
    pub to_commonjs: bool,
    /// Emit source maps (native SWC path only)
    pub source_maps: bool,
    /// Inline source maps as data URLs (native SWC path only)
    pub inline_source_map: bool,
    /// Apply compat downlevel transforms for older engines (native SWC path only)
    pub compat_for_jsc: bool,
    /// Debug level for transpilation logging
    pub debug_level: DebugLevel,
}

impl Default for TranspileOptions {
    fn default() -> Self {
        Self {
            is_typescript: false,
            target: TranspileTarget::Web,
            filename: None,
            to_commonjs: false,
            source_maps: false,
            inline_source_map: false,
            compat_for_jsc: true,
            debug_level: DebugLevel::default(),
        }
    }
}

/// Describes a single import statement
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq)]
pub struct ImportMetadata {
    pub source: String,
    pub kind: ImportKind,
    pub bindings: Vec<ImportBinding>,
}

#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "wasm", serde(tag = "type", content = "value"))]
pub enum ImportKind {
    Builtin,
    SpecialPackage,
    Module,
}

#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq)]
pub struct ImportBinding {
    pub binding_type: ImportBindingType,
    pub name: String,
    pub alias: Option<String>,
}

#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "wasm", serde(tag = "type"))]
pub enum ImportBindingType {
    Default,
    Named,
    Namespace,
}

/// Metadata about a transpiled module
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq)]
pub struct TranspileMetadata {
    pub imports: Vec<ImportMetadata>,
    pub has_jsx: bool,
    pub has_dynamic_import: bool,
    pub version: String,
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
    let debug_ctx = DebugContext::new(opts.debug_level);
    
    debug_ctx.info(format!("Starting transpilation for target: {:?}", opts.target));
    if let Some(filename) = &opts.filename {
        debug_ctx.trace(format!("File: {}", filename));
    }
    debug_ctx.trace(format!("Options: typescript={}, commonjs={}, maps={}", 
        opts.is_typescript, opts.to_commonjs, opts.source_maps));
    
    // Prefer SWC for native Android when the feature is enabled; keep wasm/web slim.
    #[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
    if opts.target == TranspileTarget::Android {
        debug_ctx.trace("Using SWC transpiler for Android target");
        let mut code = swc_native::transpile_with_swc(source, opts)
            .map_err(|e| {
                debug_ctx.error(format!("SWC transpile error: {}", e));
                format!("SWC transpile failed: {e}")
            })?;
        
        // Apply dynamic import transformation (import() -> __hook_import())
        // Always run this since SWC preserves import() calls
        debug_ctx.trace("Applying dynamic import transformation");
        code = jsx_parser::transform_dynamic_imports(&code);
        
        debug_ctx.info("Transpilation completed successfully");
        return Ok(code);
    }

    debug_ctx.trace("Using JSX parser for transpilation");
    let jsx_output = jsx_parser::transpile_jsx(source, opts).map_err(|e| {
        debug_ctx.error(format!("JSX parse error: {}", e));
        e.to_string()
    })?;
    debug_ctx.trace("JSX transformation complete");
    
    // For Android/iOS targets, apply ES5 downleveling for JavaScriptCore
    // Web target doesn't need transformation (modern browsers support ES2020+)
    if opts.target == TranspileTarget::Android {
        debug_ctx.trace("Applying ES5 downleveling for Android JavaScriptCore");
        let downleveled = swc_transformer::downlevel_for_jsc(&jsx_output)
            .map_err(|e| {
                debug_ctx.error(format!("ES5 downlevel error: {}", e));
                format!("ES5 transformation failed: {}", e)
            })?;
        
        // CRITICAL: Transform dynamic imports after downleveling
        // This ensures import() calls become __hook_import() calls
        debug_ctx.trace("Applying dynamic import transformation");
        let transformed = jsx_parser::transform_dynamic_imports(&downleveled);
        
        debug_ctx.info("Transpilation completed successfully");
        return Ok(transformed);
    }
    
    debug_ctx.info("Transpilation completed successfully");
    Ok(jsx_output)
}

/// Transform ES6 modules to CommonJS
/// Converts: import X from 'mod' → const X = require('mod')
/// Converts: export default X → module.exports.default = X
pub fn transform_es6_modules(source: &str) -> String {
    jsx_parser::transform_es6_modules(source)
}

/// Metadata about an import statement for static analysis
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq)]
pub struct StaticImportMetadata {
    pub module: String,
    pub imported: Vec<String>,
    pub is_default: bool,
    pub is_namespace: bool,
    pub is_lazy: bool,
}

/// Extract import metadata from source without executing it
/// Useful for pre-fetching imports or analyzing module dependencies
pub fn extract_imports(source: &str) -> Vec<StaticImportMetadata> {
    jsx_parser::extract_imports(source)
        .into_iter()
        .map(|m| StaticImportMetadata {
            module: m.module,
            imported: m.imported,
            is_default: m.is_default,
            is_namespace: m.is_namespace,
            is_lazy: m.is_lazy,
        })
        .collect()
}

/// Transpile JSX and extract metadata in one call
/// Returns both the transpiled code and import/JSX metadata
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
#[derive(Debug, Clone)]
pub struct TranspileResult {
    pub code: String,
    pub metadata: TranspileMetadata,
}

/// Transpile JSX with metadata extraction
/// This is the primary entry point for web clients needing full analysis
pub fn transpile_jsx_with_metadata(source: &str, _filename: Option<&str>, is_typescript: bool) -> Result<TranspileResult, String> {
    let debug_ctx = DebugContext::new(DebugLevel::default());
    
    debug_ctx.trace("Extracting metadata from source");
    
    // Detect if we have JSX
    let has_jsx = source.contains('<') && source.contains('>') && 
                  (source.contains("return") || source.contains("(") || source.contains("<"));
    debug_ctx.trace(format!("Has JSX: {}", has_jsx));
    
    // Detect dynamic imports
    let has_dynamic_import = source.contains("import(");
    debug_ctx.trace(format!("Has dynamic imports: {}", has_dynamic_import));
    
    // Transpile the JSX with Web target (no unnecessary transpilation)
    let opts = TranspileOptions {
        is_typescript,
        target: TranspileTarget::Web,
        filename: _filename.map(|f| f.to_string()),
        debug_level: DebugLevel::default(),
        ..Default::default()
    };
    let code = transpile_jsx_with_options(source, &opts)?;
    
    debug_ctx.trace("Extracting import bindings");
    // Extract imports for metadata with proper binding detection
    let imports = extract_imports_with_bindings(source);
    debug_ctx.info(format!("Extracted {} imports", imports.len()));
    
    Ok(TranspileResult {
        code,
        metadata: TranspileMetadata {
            imports,
            has_jsx,
            has_dynamic_import,
            version: version().to_string(),
        },
    })
}

/// Extract imports and detect binding types from source
fn extract_imports_with_bindings(source: &str) -> Vec<ImportMetadata> {
    jsx_parser::extract_imports(source)
        .into_iter()
        .map(|m| {
            let kind = classify_import(&m.module);
            
            // Determine binding type based on extraction metadata
            let bindings = if m.is_namespace {
                m.imported.into_iter().map(|name| {
                    ImportBinding {
                        binding_type: ImportBindingType::Namespace,
                        name,
                        alias: None,
                    }
                }).collect()
            } else if m.is_default {
                m.imported.into_iter().map(|name| {
                    ImportBinding {
                        binding_type: ImportBindingType::Default,
                        name,
                        alias: None,
                    }
                }).collect()
            } else {
                // Named imports
                m.imported.into_iter().map(|name| {
                    // Check if there's an alias (format: "original as alias")
                    if name.contains(" as ") {
                        let parts: Vec<&str> = name.split(" as ").collect();
                        ImportBinding {
                            binding_type: ImportBindingType::Named,
                            name: parts[0].trim().to_string(),
                            alias: Some(parts[1].trim().to_string()),
                        }
                    } else {
                        ImportBinding {
                            binding_type: ImportBindingType::Named,
                            name,
                            alias: None,
                        }
                    }
                }).collect()
            };
            
            ImportMetadata {
                source: m.module,
                kind,
                bindings,
            }
        })
        .collect()
}

/// Classify an import source (builtin, special package, or regular module)
fn classify_import(source: &str) -> ImportKind {
    if source == "react" || source == "react-dom" || source == "react-native" {
        ImportKind::SpecialPackage
    } else if source.starts_with("@clevertree/") {
        ImportKind::SpecialPackage
    } else if source.starts_with("@") {
        // Other scoped packages
        ImportKind::Module
    } else if source.starts_with(".") {
        ImportKind::Module
    } else if source.contains("/") {
        ImportKind::Module
    } else {
        // Unscoped packages
        ImportKind::Module
    }
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
    #[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
    fn swc_native_emits_cjs_and_sourcemap_footer() {
        let opts = TranspileOptions {
            is_typescript: false,
            target: TranspileTarget::Android,
            filename: Some("map-test.jsx".to_string()),
            to_commonjs: true,
            source_maps: true,
            inline_source_map: true,
            compat_for_jsc: true,
            debug_level: Default::default(),
        };

        let code = r#"
            export default function Component() {
                return <div>hello</div>;
            }
        "#;

        let output = transpile_jsx_with_options(code, &opts).expect("SWC transpile should succeed");
        println!("SWC output:\n{}", output);
        assert!(
            output.contains("module.exports")
                || output.contains("exports.default")
                || output.contains("Object.defineProperty(exports, \"default\"")
        , "should emit CommonJS exports");
        assert!(output.contains("__hook_jsx_runtime") || output.contains("jsx"), "should include JSX runtime calls");
        assert!(output.contains("sourceMappingURL=data:application/json;base64,"), "should include inline source map footer");
        
        // Verify source map content
        let footer_prefix = "sourceMappingURL=data:application/json;base64,";
        let footer_start = output.find(footer_prefix).unwrap() + footer_prefix.len();
        let encoded_map = &output[footer_start..].trim();
        let decoded_map = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded_map).unwrap();
        let map_json: serde_json::Value = serde_json::from_slice(&decoded_map).unwrap();
        
        assert!(map_json["sources"].as_array().unwrap().iter().any(|s| s.as_str() == Some("map-test.jsx")), "should contain filename in sources");
        assert!(map_json["sourcesContent"].as_array().is_some(), "should contain sourcesContent");
        assert!(map_json["sourcesContent"].as_array().unwrap()[0].as_str().unwrap().contains("Component"), "sourcesContent should contain original source");
    }

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

    #[test]
    fn test_transform_es6_modules() {
        let input = r#"import { useState } from 'react';
export default function MyComponent() {
  return <div>Test</div>;
}"#;
        let output = transform_es6_modules(input);
        
        // Should convert import to require
        assert!(output.contains("const { useState } = require('react')"));
        
        // Should convert export default
        assert!(output.contains("module.exports.default = function MyComponent()"));
    }

    #[test]
    fn test_transform_es6_named_exports() {
        let input = "export { foo, bar as baz };";
        let output = transform_es6_modules(input);
        
        assert!(output.contains("module.exports.foo = foo"));
        assert!(output.contains("module.exports.baz = bar"));
    }

    #[test]
    fn test_transform_es6_side_effect_imports() {
        let input = r#"import 'styles.css';"#;
        let output = transform_es6_modules(input);
        
        assert!(output.contains("require('styles.css')"));
    }

    #[test]
    fn test_extract_imports_for_prefetch() {
        let input = r#"
import React from 'react';
import { useState, useEffect } from 'react';
import * as Utils from './utils';
const lazyComp = import('./LazyComponent');
import 'styles.css';
"#;
        let imports = extract_imports(input);
        
        // Should have 5 imports (React default, React named, Utils namespace, LazyComponent lazy, styles side-effect)
        assert_eq!(imports.len(), 5);
        
        // Verify each import can be used for pre-fetching
        assert_eq!(imports[0].module, "react");
        assert!(imports[0].is_default);
        assert!(!imports[0].is_lazy);
        
        assert_eq!(imports[1].module, "react");
        assert!(!imports[1].is_default);
        assert_eq!(imports[1].imported.len(), 2);
        
        assert_eq!(imports[2].module, "./utils");
        assert!(imports[2].is_namespace);
        
        assert_eq!(imports[3].module, "./LazyComponent");
        assert!(imports[3].is_lazy);
        
        // Side-effect import (no imported names)
        assert_eq!(imports[4].module, "styles.css");
        assert!(imports[4].imported.is_empty());
    }

    #[test]
    fn test_extract_imports_with_aliases() {
        let input = "import { useState as State, useEffect as Effect } from 'react';";
        let imports = extract_imports(input);
        
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].imported.len(), 2);
        assert!(imports[0].imported.contains(&"State".to_string()));
        assert!(imports[0].imported.contains(&"Effect".to_string()));
    }

    #[test]
    fn test_extract_imports_scoped_packages() {
        let input = "import { Logger } from '@myorg/logging';";
        let imports = extract_imports(input);
        
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].module, "@myorg/logging");
        assert_eq!(imports[0].imported, vec!["Logger"]);
    }

    #[test]
    fn test_combined_module_transformation_and_extraction() {
        let source = r#"
import React, { useState } from 'react';
import './styles.css';

export const useMyHook = () => {
  const [state, setState] = useState(null);
  return state;
};

export default function Component() {
  return <div>Test</div>;
}
"#;
        
        // Extract imports for static analysis
        let imports = extract_imports(source);
        
        // Should have 2 imports: 
        // 1. React and useState from react
        // 2. styles.css side-effect
        assert!(imports.len() >= 2);
        
        // Find the react import (may be split or combined depending on parser)
        let react_imports: Vec<_> = imports.iter()
            .filter(|i| i.module == "react")
            .collect();
        assert!(!react_imports.is_empty());
        
        // Find the styles import
        let styles_import = imports.iter()
            .find(|i| i.module == "./styles.css");
        assert!(styles_import.is_some());
        
        // Transform to CommonJS
        let transformed = transform_es6_modules(source);
        assert!(transformed.contains("require('react')") || transformed.contains("require(\"react\")"));
        assert!(transformed.contains("require('./styles.css')") || transformed.contains("require(\"./styles.css\")"));
        assert!(transformed.contains("module.exports.useMyHook"));
        assert!(transformed.contains("module.exports.default"));
    }

    #[test]
    fn test_lazy_import_extraction() {
        let source = r#"
const lazyForm = import('./forms/FormComponent');
const lazyModal = import('./modals/Modal');
"#;
        let imports = extract_imports(source);
        
        assert_eq!(imports.len(), 2);
        assert!(imports[0].is_lazy);
        assert!(imports[1].is_lazy);
        assert_eq!(imports[0].module, "./forms/FormComponent");
        assert_eq!(imports[1].module, "./modals/Modal");
    }
}
