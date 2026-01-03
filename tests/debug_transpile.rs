use relay_hook_transpiler::{
    transpile_jsx_with_options, TranspileOptions, TranspileTarget, DebugLevel,
};

#[test]
fn test_debug_level_default_is_trace() {
    let opts = TranspileOptions::default();
    #[cfg(feature = "debug")]
    {
        assert_eq!(opts.debug_level, DebugLevel::Trace);
    }
    #[cfg(not(feature = "debug"))]
    {
        assert_eq!(opts.debug_level, DebugLevel::Off);
    }
}

#[test]
fn test_transpile_with_debug_trace_level() {
    let source = "<div>Hello Debug</div>";
    let opts = TranspileOptions {
        is_typescript: false,
        target: TranspileTarget::Web,
        filename: Some("debug_test.jsx".to_string()),
        debug_level: DebugLevel::Trace,
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts);
    assert!(
        result.is_ok(),
        "Transpilation with Trace debug level should succeed"
    );

    let output = result.unwrap();
    assert!(output.contains("__hook_jsx_runtime.jsx"));
    assert!(output.contains("Hello Debug"));
}

#[test]
fn test_transpile_with_debug_off() {
    let source = "<span>No Debug</span>";
    let opts = TranspileOptions {
        is_typescript: false,
        target: TranspileTarget::Web,
        filename: Some("nodebug.jsx".to_string()),
        debug_level: DebugLevel::Off,
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts);
    assert!(result.is_ok(), "Transpilation with debug off should succeed");

    let output = result.unwrap();
    assert!(output.contains("__hook_jsx_runtime.jsx"));
    assert!(output.contains("span"));
}

#[test]
fn test_transpile_debug_hook_with_debugger_statements() {
    let source = include_str!("fixtures/debug_hook.jsx");
    let opts = TranspileOptions {
        is_typescript: false,
        target: TranspileTarget::Web,
        filename: Some("debug_hook.jsx".to_string()),
        debug_level: DebugLevel::Trace,
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts);
    assert!(result.is_ok(), "debug_hook.jsx should transpile successfully");

    let output = result.unwrap();
    // Verify debugger statements are preserved
    assert!(
        output.contains("debugger"),
        "debugger statements should be preserved in output"
    );

    // Verify JSX was transpiled
    assert!(output.contains("__hook_jsx_runtime.jsx"));

    // Verify imports are handled
    assert!(
        output.contains("React") || output.contains("useState"),
        "React imports should be present"
    );
}

#[test]
fn test_debug_level_ordering() {
    assert!(DebugLevel::Off < DebugLevel::Error);
    assert!(DebugLevel::Error < DebugLevel::Warn);
    assert!(DebugLevel::Warn < DebugLevel::Info);
    assert!(DebugLevel::Info < DebugLevel::Trace);
    assert!(DebugLevel::Trace < DebugLevel::Verbose);
}

#[test]
fn test_debug_level_string_parsing() {
    assert_eq!("off".parse::<DebugLevel>().unwrap(), DebugLevel::Off);
    assert_eq!("error".parse::<DebugLevel>().unwrap(), DebugLevel::Error);
    assert_eq!("warn".parse::<DebugLevel>().unwrap(), DebugLevel::Warn);
    assert_eq!("info".parse::<DebugLevel>().unwrap(), DebugLevel::Info);
    assert_eq!("trace".parse::<DebugLevel>().unwrap(), DebugLevel::Trace);
    assert_eq!("verbose".parse::<DebugLevel>().unwrap(), DebugLevel::Verbose);

    // Test numeric parsing
    assert_eq!("0".parse::<DebugLevel>().unwrap(), DebugLevel::Off);
    assert_eq!("4".parse::<DebugLevel>().unwrap(), DebugLevel::Trace);
    assert_eq!("5".parse::<DebugLevel>().unwrap(), DebugLevel::Verbose);
}

#[test]
fn test_debug_level_display() {
    assert_eq!(DebugLevel::Off.to_string(), "off");
    assert_eq!(DebugLevel::Error.to_string(), "error");
    assert_eq!(DebugLevel::Trace.to_string(), "trace");
    assert_eq!(DebugLevel::Verbose.to_string(), "verbose");
}

#[test]
fn test_transpile_typescript_with_debug() {
    let source = r#"
import { useState }: React from 'react';

export const MyHook = (): [string, (s: string) => void] => {
  debugger;
  const [value, setValue] = useState('');
  return [value, setValue];
};

export default function MyComponent(): JSX.Element {
  debugger;
  const [state, setState] = useState<string>('test');
  return <div>{state}</div>;
}
"#;

    let opts = TranspileOptions {
        is_typescript: true,
        target: TranspileTarget::Web,
        filename: Some("debug.tsx".to_string()),
        debug_level: DebugLevel::Trace,
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts);
    assert!(
        result.is_ok(),
        "TypeScript transpilation with debug should succeed"
    );

    let output = result.unwrap();
    assert!(
        output.contains("debugger"),
        "debugger statements should be preserved"
    );
}

#[test]
fn test_android_target_with_debug_trace() {
    let source = "<div>Android Debug</div>";
    let opts = TranspileOptions {
        is_typescript: false,
        target: TranspileTarget::Android,
        filename: Some("android_debug.jsx".to_string()),
        debug_level: DebugLevel::Trace,
        to_commonjs: true,
        compat_for_jsc: true,
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts);
    // May fail on web build without SWC, but shouldn't panic
    match result {
        Ok(output) => {
            assert!(
                output.contains("__hook_jsx_runtime") || output.contains("div"),
                "should produce transpiled output"
            );
        }
        Err(e) => {
            // Expected on web-only builds without native-swc feature
            assert!(e.contains("SWC") || e.contains("transformation"));
        }
    }
}

#[test]
fn test_transpile_with_debug_verbose_level() {
    let source = "<p>Verbose Debug Test</p>";
    let opts = TranspileOptions {
        is_typescript: false,
        target: TranspileTarget::Web,
        filename: Some("verbose.jsx".to_string()),
        debug_level: DebugLevel::Verbose,
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts);
    assert!(
        result.is_ok(),
        "Transpilation with Verbose debug should succeed"
    );

    let output = result.unwrap();
    assert!(output.contains("p"));
    assert!(output.contains("__hook_jsx_runtime.jsx"));
}
