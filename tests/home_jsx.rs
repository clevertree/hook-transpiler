use relay_hook_transpiler::transpile_jsx_simple;

#[test]
fn home_jsx_transpiles_without_raw_jsx_tokens() {
    let src = include_str!("fixtures/home_original.jsx");

    let out = transpile_jsx_simple(src).expect("home.jsx should transpile");

    assert!(out.contains("__hook_jsx_runtime.jsx"), "should emit jsx runtime calls");
    assert!(out.contains("probePeer"), "should keep helper functions in output");
    assert!(out.contains("export default function Home"), "should preserve export default");
    assert!(!out.contains("<div"), "transpiled output still contains raw JSX: {out}");
}
