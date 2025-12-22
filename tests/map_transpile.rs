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

#[test]
fn map_with_sibling_elements_creates_nested_array() {
    // This test covers the edge case where .map() is used alongside other JSX elements,
    // creating a nested array structure: children: [element1, [mapped items]]
    // The renderer must flatten this to properly render all items
    let src = r#"
        export default function Home() {
            const peers = [
                { host: 'node1.example.com', note: 'Primary' },
                { host: 'node2.example.com', note: 'Secondary' }
            ];
            
            return <div className="container">
                <div className="header">
                    <span>Peer List</span>
                </div>
                <div className="content">
                    <div className="label">
                        <span>Available Peers</span>
                    </div>
                    {peers.map(peer => (
                        <div key={peer.host}>
                            <span>{peer.host}</span>
                            <span>{peer.note}</span>
                        </div>
                    ))}
                </div>
            </div>;
        }
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile");

    // Verify the structure creates nested arrays
    // The "content" div should have children array containing both:
    // 1. A "label" div element
    // 2. A peers.map() call that returns an array
    assert!(out.contains("peers.map"), "should preserve peers.map call");
    
    // Verify the label div is before the map
    let label_pos = out.find("\"label\"").expect("should contain label class");
    let map_pos = out.find("peers.map").expect("should contain peers.map");
    assert!(label_pos < map_pos, "label div should come before peers.map in output");
    
    // Verify the map returns JSX elements with the correct structure
    assert!(out.contains("__hook_jsx_runtime.jsx(\"div\", { key: peer.host"), 
            "map should return div elements with key prop");
    assert!(out.contains("children: [peer.host]"), 
            "first span in mapped items should contain peer.host");
    assert!(out.contains("children: [peer.note]"), 
            "second span in mapped items should contain peer.note");
    
    // The critical part: children array contains both static element and map result
    // This creates: children: [labelDiv, peers.map(peer => div)]
    // Which becomes: children: [labelDiv, [div1, div2, ...]]
    assert!(out.contains("className: \"content\""), "content div should exist");
}

#[test]
fn nested_map_calls_transpile() {
    // Test case for nested .map() calls (arrays within arrays within arrays)
    let src = r#"
        <div>
            {categories.map(cat => (
                <div key={cat.id}>
                    <h2>{cat.name}</h2>
                    {cat.items.map(item => (
                        <span key={item.id}>{item.title}</span>
                    ))}
                </div>
            ))}
        </div>
    "#;
    let out = transpile_jsx_simple(src).expect("should transpile nested maps");

    // Should contain both map calls
    assert!(out.contains("categories.map"), "should contain outer map");
    assert!(out.contains("cat.items.map"), "should contain inner map");
    
    // Both should produce JSX elements
    assert!(out.contains("__hook_jsx_runtime.jsx(\"div\", { key: cat.id"), 
            "outer map should create divs");
    assert!(out.contains("__hook_jsx_runtime.jsx(\"span\", { key: item.id"), 
            "inner map should create spans");
}
