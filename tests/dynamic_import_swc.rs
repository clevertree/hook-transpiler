#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]
#[test]
fn test_dynamic_import_transformation() {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions, TranspileTarget};
    
    let source = r#"
import { useState, useEffect } from "react";

export default function Test() {
    const [data, setData] = useState(null);
    
    useEffect(() => {
        Promise.all([
            import("./lazy-data.js"),
            import("/hooks/lazy-data.js")
        ]).then(([rel, abs]) => {
            setData({ rel: rel.default, abs: abs.default });
        });
    }, []);
    
    return <div>{data?.rel || "Loading..."}</div>;
}
"#;

    let opts = TranspileOptions {
        filename: Some("test.jsx".to_string()),
        is_typescript: false,
        target: TranspileTarget::Android,
        debug_level: Default::default(),
        ..Default::default()
    };
    
    let result = transpile_jsx_with_options(source, &opts).expect("transpilation failed");
    
    println!("=== TRANSPILED OUTPUT ===");
    println!("{}", result);
    println!("=== END ===");
    
    // Check that import() was transformed to __hook_import()
    assert!(result.contains("__hook_import"), "Dynamic imports should be transformed to __hook_import()");
    // Success! The transformation is working
}
