use relay_hook_transpiler::transpile_jsx_simple;

#[test]
fn test_literal_array_of_jsx() {
    let src = r#"
        <div>
            {[
                <span key="1">One</span>,
                <span key="2">Two</span>
            ]}
        </div>
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");
    println!("OUTPUT:\n{}", out);
    
    assert!(out.contains("__hook_jsx_runtime.jsx(\"span\", { key: \"1\", children: [\"One\"] })"));
    assert!(out.contains("__hook_jsx_runtime.jsx(\"span\", { key: \"2\", children: [\"Two\"] })"));
    // Ensure the array structure is preserved
    assert!(out.contains("children: [["));
    assert!(out.contains("]] })")); 
}

#[test]
fn test_peers_map_node_count() {
    let src = r#"
            {peers.map(peer => (
                <div key={peer.host}>
                    <span>{peer.host}</span>
                    <span>{peer.note}</span>
                    <span>Status: Not probed</span>
                </div>
            ))}
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");
    let count = out.matches("__hook_jsx_runtime.jsx").count();
    // 1 for div, 3 for spans = 4 total
    assert_eq!(count, 4, "Should have 4 JSX nodes, found {count}\nOutput: {out}");
}

#[test]
fn test_literal_array_node_count() {
    let src = r#"
        <div>
            {[
                <span key="1">One</span>,
                <span key="2">Two</span>,
                <span key="3">Three</span>
            ]}
        </div>
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");
    let count = out.matches("__hook_jsx_runtime.jsx").count();
    // 1 for div, 3 for spans = 4 total
    assert_eq!(count, 4, "Should have 4 JSX nodes, found {count}\nOutput: {out}");
}

#[test]
fn test_deeply_nested_arrays() {
    let src = r#"
        <div>
            { [
                <div key="1">
                    { [ <span key="1.1">Deep</span>, <span key="1.2">Nested</span> ] }
                </div>,
                <div key="2">
                    { [ <span key="2.1">More</span>, <span key="2.2">Elements</span> ] }
                </div>
            ] }
        </div>
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");
    println!("DEEP OUTPUT:\n{}", out);
    let count = out.matches("__hook_jsx_runtime.jsx").count();
    // 1 (outer div) + 2 (inner divs) + 4 (spans) = 7 total
    assert_eq!(count, 7, "Should have 7 JSX nodes, found {count}\nOutput: {out}");
    
    // Verify structure of one of the inner divs (note: whitespace might be preserved from original expression)
    assert!(out.contains("children: [ [ __hook_jsx_runtime.jsx(\"span\", { key: \"1.1\", children: [\"Deep\"] }), __hook_jsx_runtime.jsx(\"span\", { key: \"1.2\", children: [\"Nested\"] }) ] ]"));
}

#[test]
fn test_long_array() {
    let mut src = String::from("<div>{ [");
    for i in 0..100 {
        src.push_str(&format!("<span key=\"{}\">{}</span>,", i, i));
    }
    src.push_str("] }</div>");
    let out = transpile_jsx_simple(&src).expect("should transpile");
    let count = out.matches("__hook_jsx_runtime.jsx").count();
    assert_eq!(count, 101); // 1 div + 100 spans
}

#[test]
fn test_nested_array_in_map() {
    let src = r#"
        <ul>
            {items.map(item => [
                <li key={item.id + "-1"}>{item.name} (1)</li>,
                <li key={item.id + "-2"}>{item.name} (2)</li>
            ])}
        </ul>
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");

    assert!(out.contains("item => ["));
    assert!(out.contains("__hook_jsx_runtime.jsx(\"li\", { key: item.id + \"-1\""));
    assert!(out.contains("__hook_jsx_runtime.jsx(\"li\", { key: item.id + \"-2\""));
}

#[test]
fn test_array_in_props() {
    let src = r#"
        <MyList 
            items={[
                <Item id={1} />,
                <Item id={2} />
            ]}
        />
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");

    assert!(out.contains("items: ["));
    assert!(out.contains("__hook_jsx_runtime.jsx(Item, { id: 1 })"));
    assert!(out.contains("__hook_jsx_runtime.jsx(Item, { id: 2 })"));
}

#[test]
fn test_mixed_array() {
    let src = r#"
        <div>
            {[
                "Static text",
                <div key="div">JSX element</div>,
                42,
                variable
            ]}
        </div>
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");

    assert!(out.contains("\"Static text\""));
    assert!(out.contains("__hook_jsx_runtime.jsx(\"div\", { key: \"div\", children: [\"JSX element\"] })"));
    assert!(out.contains("42"));
    assert!(out.contains("variable"));
}
