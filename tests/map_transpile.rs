use relay_hook_transpiler::transpile_jsx_simple;

#[test]
fn map_transpiles_correctly() {
    let src = include_str!("fixtures/map_test.jsx");
    let out = transpile_jsx_simple(src).expect("map_test.jsx should transpile");

    assert!(out.contains("__hook_jsx_runtime.jsx"), "should emit jsx runtime calls");
    assert!(!out.contains("<div"), "transpiled output still contains raw JSX");
    
    assert!(out.contains("peers.map"), "should contain peers.map");
    // If it's a custom component, it should NOT be quoted
    assert!(out.contains("__hook_jsx_runtime.jsx(Item"), "custom component Item should not be quoted");
}

#[test]
fn comprehensive_map_test() {
    let src = r#"
        <div>
          {peers.map(p => (
              <div key={p.id}>
                  <span>{p.name}</span>
                  <button onClick={() => remove(p.id)}>X</button>
              </div>
          ))}
        </div>
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");

    // Verify root div
    assert!(out.contains("__hook_jsx_runtime.jsx(\"div\", { children: [peers.map("));
    
    // Verify inner div inside map
    assert!(out.contains("__hook_jsx_runtime.jsx(\"div\", { key: p.id, children: ["));
    
    // Verify span inside inner div
    assert!(out.contains("__hook_jsx_runtime.jsx(\"span\", { children: [p.name] })"));
    
    // Verify button inside inner div
    assert!(out.contains("__hook_jsx_runtime.jsx(\"button\", { onClick: () => remove(p.id), children: [\"X\"] })"));
}

#[test]
fn jsx_in_props_transpiles() {
    let src = r#"
        <MyComponent 
            header={<div>Header</div>} 
            footer={<span>Footer</span>}
        />
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");

    assert!(out.contains("header: __hook_jsx_runtime.jsx(\"div\""));
    assert!(out.contains("footer: __hook_jsx_runtime.jsx(\"span\""));
}
