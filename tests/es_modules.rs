use relay_hook_transpiler::transpile_jsx_simple;

#[test]
fn preserves_import_and_export_default() {
    let src = r#"import { useState } from 'react';
import shared from './shared.js';

export default function Widget() {
    const [count, setCount] = useState(0);
    return <div className="box">Count: {count}</div>;
}
"#;

    let out = transpile_jsx_simple(src).expect("transpile should succeed");

    // ES module syntax should be left intact.
    assert!(out.contains("import { useState } from 'react';"));
    assert!(out.contains("export default function Widget"));
    // JSX must be rewritten.
    assert!(out.contains("__hook_jsx_runtime.jsx"));
}

#[test]
fn preserves_dynamic_import_in_code() {
    let src = r#"export default async function Lazy() {
    const mod = await import('./chunk.js');
    return <div>{mod.value}</div>;
}
"#;

    let out = transpile_jsx_simple(src).expect("transpile should succeed");

    // Dynamic import should remain unchanged.
    assert!(out.contains("import('./chunk.js')"));
    // JSX should be rewritten.
    assert!(out.contains("__hook_jsx_runtime.jsx"));
}
