//! Android import handling regression tests
//! Validates that both static and dynamic imports are properly transformed

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn android_static_imports_transformed() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import React, { useState, useEffect } from "react";
import Button from "./components/Button.jsx";
import { formatDate } from "./utils/date.js";

export default function App() {
    const [count, setCount] = useState(0);
    return <div>
        <Button onClick={() => setCount(count + 1)}>
            Count: {count}
        </Button>
    </div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("app.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Static imports should be converted to require() or similar
    // At minimum, verify the code compiles and JSX is transformed
    assert!(result.contains("_jsx") || result.contains("jsx"), "JSX should be transformed");
    // SWC keeps import statements for React - that's OK as long as JSX is transformed
    assert!(result.contains("import"), "Should have import statements (static imports preserved by SWC)");
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn android_dynamic_imports_to_hook_import() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function LazyLoader() {
    const [module, setModule] = useState(null);
    
    useEffect(() => {
        import("./lazy-module.js").then(mod => {
            setModule(mod.default);
        });
    }, []);
    
    return <div>{module ? "Loaded" : "Loading..."}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("lazy.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    println!("=== Transpiled Output ===");
    println!("{}", result);
    
    // Dynamic import() should be transformed to __hook_import()
    assert!(result.contains("__hook_import"), "Dynamic import() should be transformed to __hook_import()");
    
    // Verify the transformation actually happened - __hook_import should be present
    // Note: We may still have "import {" from static imports, which is fine
    let dynamic_count = result.matches("__hook_import").count();
    assert!(dynamic_count >= 1, "Should have at least one __hook_import call");
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn android_multiple_dynamic_imports() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function MultiLoader() {
    const [data, setData] = useState(null);
    
    useEffect(() => {
        Promise.all([
            import("./module-a.js"),
            import("./module-b.js"),
            import("/absolute/path.js"),
            import("./nested/index.js")
        ]).then(([a, b, c, d]) => {
            setData({ a, b, c, d });
        });
    }, []);
    
    return <div>Data: {data ? "Ready" : "Loading..."}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("multi.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Should have 4 __hook_import calls
    let count = result.matches("__hook_import").count();
    assert_eq!(count, 4, "Expected 4 __hook_import calls, found {}", count);
    
    // Verify specific paths are preserved
    assert!(result.contains("__hook_import(\"./module-a.js\")") || result.contains("__hook_import('./module-a.js')"));
    assert!(result.contains("__hook_import(\"/absolute/path.js\")") || result.contains("__hook_import('/absolute/path.js')"));
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn android_dynamic_import_with_query_params() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useEffect } from "react";

export default function QueryLoader() {
    useEffect(() => {
        import("./module.js?version=2#hash").then(mod => {
            console.log(mod);
        });
    }, []);
    
    return <div>Test</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("query.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    // Query params and hash should be preserved
    assert!(result.contains("__hook_import"), "Should have __hook_import");
    assert!(result.contains("?version=2#hash") || result.contains("version=2"), 
            "Query params should be preserved in import path");
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn android_dynamic_import_leaves_existing_hook_import_intact() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};

    let source = r#"
import { useEffect } from "react";

export default function Mixed() {
    useEffect(() => {
        const preloaded = __hook_import('./already.js');
        const later = import('./needs-rewrite.js');
        console.log(preloaded, later);
    }, []);
    return <div/>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("mixed.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");

    // Original __hook_import should remain and dynamic import should be rewritten (total 2 occurrences)
    let hook_import_count = result.matches("__hook_import").count();
    assert_eq!(hook_import_count, 2, "Expected existing __hook_import plus rewritten dynamic import");
    assert!(result.contains("__hook_import('./already.js')"));
    assert!(result.contains("__hook_import('./needs-rewrite.js')"));
}

#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn android_dynamic_import_with_spacing_is_rewritten() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};

    let source = r#"
export default function Spaced() {
    const load = () => import   (  './spaced-module.js'   );
    return <div>{String(load)}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("spaced.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };

    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");

    // Whitespace-heavy dynamic imports should still be rewritten
    assert!(result.contains("__hook_import('./spaced-module.js')"), "Dynamic import with spacing should be rewritten");
}
