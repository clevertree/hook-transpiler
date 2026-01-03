use relay_hook_transpiler::{transform_es6_modules, transpile_jsx_with_options, TranspileOptions, TranspileTarget};

#[test]
fn transforms_multiline_imports() {
    let src = r#"import React, {
  useState,
  useEffect
} from 'react';

export default
function MyComponent() {
    return null;
}
"#;

    let out = transform_es6_modules(src);
    assert!(out.contains("const React = require('react');"));
    assert!(out.contains("const {") && out.contains("useState") && out.contains("useEffect") && out.contains("= React"));
    assert!(out.contains("module.exports.default ="));
    assert!(out.contains("function MyComponent()"));
}

#[test]
fn transforms_export_const() {
    let src = "export const MyValue = 42;";
    let out = transform_es6_modules(src);
    
    assert!(out.contains("const MyValue = 42;"));
    assert!(out.contains("module.exports.MyValue = MyValue;"));
}

#[test]
fn transforms_side_effect_import() {
    let src = "import './styles.css';";
    let out = transform_es6_modules(src);
    
    assert!(out.contains("require('./styles.css');"));
}

#[test]
fn transforms_export_default_with_newline() {
    let src = r#"export default
function getClient() {
    return 42;
}
"#;
    let out = transform_es6_modules(src);
    
    assert!(out.contains("module.exports.default ="));
    assert!(out.contains("function getClient()"));
}

#[test]
fn handles_optional_chaining() {
    let src = "console.log(a?.b);";
    let out = transpile_jsx_with_options(
        src,
        &TranspileOptions {
            target: TranspileTarget::Android,
            ..Default::default()
        },
    )
    .unwrap();
    // Both native-swc and swc_transformer downlevel optional chaining
    assert!(out.contains("!= null") || out.contains("== null"));
}

#[test]
fn handles_nested_optional_chaining() {
    let src = "console.log(a?.b?.c);";
    let out = transpile_jsx_with_options(
        src,
        &TranspileOptions {
            target: TranspileTarget::Android,
            ..Default::default()
        },
    )
    .unwrap();
    // Both paths downlevel nested optional chaining
    assert!(out.contains("!= null") || out.contains("== null"));
}

#[test]
fn handles_nullish_coalescing() {
    let source = "const x = a ?? b;";
    let output = transpile_jsx_with_options(
        source,
        &TranspileOptions {
            target: TranspileTarget::Android,
            ..Default::default()
        },
    )
    .unwrap();
    // Both paths downlevel nullish coalescing
    assert!(output.contains("!= null") || output.contains("== null"));
}

#[test]
fn handles_optional_call() {
    let src = "a?.(b);";
    let out = transpile_jsx_with_options(
        src,
        &TranspileOptions {
            target: TranspileTarget::Android,
            ..Default::default()
        },
    )
    .unwrap();
    // Both paths downlevel optional call
    assert!(out.contains("!= null") || out.contains("== null"));
}

#[test]
fn handles_optional_index() {
    let src = "a?.[b];";
    let out = transpile_jsx_with_options(
        src,
        &TranspileOptions {
            target: TranspileTarget::Android,
            ..Default::default()
        },
    )
    .unwrap();
    // Both paths downlevel optional index
    assert!(out.contains("!= null") || out.contains("== null"));
}