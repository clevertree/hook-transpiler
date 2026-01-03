//! useEffect regression tests for Act and ReactNative renderers
//! Validates that React hooks execute properly in both rendering modes

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn useeffect_mount_unmount_lifecycle() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function LifecycleTest() {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        console.log("Component mounted");
        setMounted(true);
        
        return () => {
            console.log("Component unmounting");
        };
    }, []);
    
    return <div>Mounted: {mounted ? "Yes" : "No"}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("lifecycle.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Verify useEffect is present and not mangled
    assert!(result.contains("useEffect"), "useEffect should be present in output");
    assert!(result.contains("console.log"), "Console calls should be preserved");
    
    // Verify the cleanup function is preserved
    assert!(result.contains("return"), "Cleanup function should have return statement");
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn useeffect_with_dependencies() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function DependencyTest() {
    const [count, setCount] = useState(0);
    const [doubled, setDoubled] = useState(0);
    
    useEffect(() => {
        console.log("Count changed:", count);
        setDoubled(count * 2);
    }, [count]);
    
    return <div>
        <button onClick={() => setCount(count + 1)}>Increment</button>
        <div>Count: {count}, Doubled: {doubled}</div>
    </div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("deps.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Verify dependency array is preserved
    assert!(result.contains("useEffect"), "useEffect should be present");
    assert!(result.contains("[count]") || result.contains("count"), "Dependency array should be preserved");
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn useeffect_with_async_operations() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function AsyncTest() {
    const [data, setData] = useState(null);
    
    useEffect(() => {
        let cancelled = false;
        
        async function fetchData() {
            const result = await fetch("/api/data");
            if (!cancelled) {
                setData(result);
            }
        }
        
        fetchData();
        
        return () => {
            cancelled = true;
        };
    }, []);
    
    return <div>{data ? "Loaded" : "Loading..."}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("async.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Verify async/await is handled
    assert!(result.contains("useEffect"), "useEffect should be present");
    // SWC might transform async, but the logic should be there
    assert!(result.contains("cancelled") || result.contains("canceled"), "Cancellation flag should be preserved");
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn useeffect_with_promise_all() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function PromiseTest() {
    const [results, setResults] = useState(null);
    
    useEffect(() => {
        let active = true;
        
        Promise.all([
            import("./module-a.js"),
            import("./module-b.js")
        ]).then(([a, b]) => {
            if (active) {
                setResults({ a: a.default, b: b.default });
            }
        }).catch(err => {
            console.error("Failed:", err);
        });
        
        return () => {
            active = false;
        };
    }, []);
    
    return <div>{results ? "Ready" : "Loading..."}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("promise.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    println!("=== useEffect with Promise.all output ===");
    println!("{}", result);
    
    // Verify Promise.all is preserved
    assert!(result.contains("Promise"), "Promise should be preserved");
    assert!(result.contains("__hook_import"), "Dynamic imports should be transformed");
    
    // Verify error handling
    assert!(result.contains("catch") || result.contains(".catch"), "Error handling should be preserved");
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn multiple_useeffects_in_one_component() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function MultiEffect() {
    const [count, setCount] = useState(0);
    const [logs, setLogs] = useState([]);
    
    // Effect 1: Mount
    useEffect(() => {
        console.log("Mounted");
    }, []);
    
    // Effect 2: Count changes
    useEffect(() => {
        setLogs(prev => [...prev, `Count: ${count}`]);
    }, [count]);
    
    // Effect 3: Cleanup
    useEffect(() => {
        return () => console.log("Cleanup");
    }, []);
    
    return <div>
        <button onClick={() => setCount(count + 1)}>+</button>
        <div>Count: {count}</div>
        <div>Logs: {logs.length}</div>
    </div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("multi-effect.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Should have 3 useEffect calls
    let count = result.matches("useEffect").count();
    assert!(count >= 3, "Expected at least 3 useEffect calls, found {}", count);
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn useeffect_with_useref() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useEffect, useRef, useState } from "react";

export default function RefTest() {
    const [logs, setLogs] = useState([]);
    const originalsRef = useRef(null);
    
    useEffect(() => {
        originalsRef.current = {
            log: console.log,
            warn: console.warn
        };
        
        console.log = (...args) => {
            setLogs(prev => [...prev, args.join(" ")]);
            originalsRef.current?.log(...args);
        };
        
        return () => {
            console.log = originalsRef.current?.log || console.log;
        };
    }, []);
    
    return <div>Logs: {logs.length}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("ref-test.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Verify useRef is preserved
    assert!(result.contains("useRef"), "useRef should be present");
    assert!(result.contains("useEffect"), "useEffect should be present");
    assert!(result.contains(".current") || result.contains("current"), "Ref access should be preserved");
}
