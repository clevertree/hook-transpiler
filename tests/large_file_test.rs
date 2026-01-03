use relay_hook_transpiler::{transpile_jsx_simple, TranspileOptions};

/// Test for the crash that occurred with test-hook.jsx (3837 bytes)
/// This file has multiple imports, hooks, and complex JSX
#[test]
fn test_hook_jsx_large_file() {
    let src = include_str!("../tests/android/app/src/main/assets/test-hook.jsx");
    
    println!("Source length: {} bytes", src.len());
    
    let result = transpile_jsx_simple(src);
    
    match &result {
        Ok(output) => {
            println!("Transpiled successfully: {} bytes", output.len());
            assert!(output.contains("__hook_jsx_runtime"), "should use jsx runtime");
            assert!(output.contains("useState"), "should preserve hooks");
            assert!(output.contains("ListItem"), "should preserve component references");
        }
        Err(e) => {
            panic!("Transpilation failed: {}", e);
        }
    }
}

/// Test with compat_for_jsc enabled (Android mode)
#[test]
fn test_hook_jsx_with_jsc_compat() {
    let src = include_str!("../tests/android/app/src/main/assets/test-hook.jsx");
    
    let opts = TranspileOptions {
        filename: Some("test-hook.jsx".to_string()),
        is_typescript: false,
        target: relay_hook_transpiler::TranspileTarget::Android,
        to_commonjs: true,
        compat_for_jsc: true,
        ..Default::default()
    };
    
    let result = relay_hook_transpiler::transpile_jsx_with_options(src, &opts);
    
    match result {
        Ok(output) => {
            println!("Transpiled with JSC compat: {} bytes", output.len());
            
            // Print first 500 chars to see what's happening
            println!("First 500 chars:\n{}", &output[..output.len().min(500)]);
            
            // Count occurrences
            let const_count = output.matches("const ").count();
            let let_count = output.matches("let ").count();
            let var_count = output.matches("var ").count();
            
            println!("\nKeyword counts: const={}, let={}, var={}", const_count, let_count, var_count);
            
            // Should not contain const/let
            assert!(!output.contains("const "), "should convert const to var (found {} occurrences)", const_count);
            assert!(!output.contains("let "), "should convert let to var (found {} occurrences)", let_count);
            // Should have var instead
            assert!(output.contains("var "), "should use var declarations");
        }
        Err(e) => {
            panic!("JSC compat transpilation failed: {}", e);
        }
    }
}

/// Test the advanced-test.jsx that we created
#[test]
fn advanced_test_jsx_transpiles() {
    let src = include_str!("../tests/android/app/src/main/assets/advanced-test.jsx");
    
    let opts = TranspileOptions {
        filename: Some("advanced-test.jsx".to_string()),
        is_typescript: false,
        target: relay_hook_transpiler::TranspileTarget::Android,
        to_commonjs: true,
        compat_for_jsc: true,
        ..Default::default()
    };
    
    let result = relay_hook_transpiler::transpile_jsx_with_options(src, &opts);
    
    match result {
        Ok(output) => {
            println!("Advanced test transpiled: {} bytes", output.len());
            assert!(!output.contains("const "), "should not contain const");
            assert!(output.contains("var "), "should use var");
            assert!(output.contains("AdvancedTest"), "should preserve function name");
        }
        Err(e) => {
            panic!("Advanced test transpilation failed: {}", e);
        }
    }
}

/// Regression test for block scoping with nested functions
#[test]
fn block_scoping_with_arrow_functions() {
    let src = r#"
import React from 'react';

export default function Component() {
    const items = [1, 2, 3];
    const [count, setCount] = React.useState(0);
    
    return (
        <div>
            <button onClick={() => setCount(count + 1)}>
                Clicked {count} times
            </button>
            <ul>
                {items.map(item => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}
"#;
    
    let opts = TranspileOptions {
        filename: Some("test.jsx".to_string()),
        is_typescript: false,
        target: relay_hook_transpiler::TranspileTarget::Android,
        to_commonjs: true,
        compat_for_jsc: true,
        ..Default::default()
    };
    
    let result = relay_hook_transpiler::transpile_jsx_with_options(src, &opts);
    
    match result {
        Ok(output) => {
            println!("Block scoping test output:\n{}", output);
            assert!(!output.contains("const "), "should not contain const");
            assert!(!output.contains("let "), "should not contain let");
            assert!(output.contains("var "), "should use var");
        }
        Err(e) => {
            panic!("Block scoping test failed: {}", e);
        }
    }
}

#[test]
fn typescript_jsx_simple() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions};
    
    let src = r#"const x: string = 'test'; <div>{x}</div>"#;
    let opts = TranspileOptions {
        is_typescript: true,
        filename: Some("test.tsx".to_string()),
        target: relay_hook_transpiler::TranspileTarget::Android,
        to_commonjs: true,
        compat_for_jsc: true,
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(src, &opts);
    match result {
        Ok(output) => {
            println!("TypeScript JSX transpiled: {} bytes", output.len());
            println!("Output:\n{}", output);
            assert!(!output.contains(": string"), "should strip TS types");
        },
        Err(e) => {
            panic!("TypeScript transpilation failed: {}", e);
        }
    }
}
