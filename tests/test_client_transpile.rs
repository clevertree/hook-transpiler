#[test]
fn test_client_jsx_dynamic_import() {
    use std::fs;
    
    let source = fs::read_to_string("/home/ari/dev/hook-transpiler/tests/android/app/src/main/assets/client.jsx")
        .expect("Failed to read client.jsx");
    
    let opts = relay_hook_transpiler::TranspileOptions {
        filename: Some("client.jsx".to_string()),
        target: relay_hook_transpiler::TranspileTarget::Android,
        ..Default::default()
    };
    
    let result = relay_hook_transpiler::transpile_jsx_with_options(&source, &opts)
        .expect("Transpilation failed");
    
    // Check if dynamic imports were transformed
    println!("=== Checking for dynamic import transformation ===");
    
    // We expect one import( in the <p> tag, but none in the code
    
    // Let's use a more robust check: count "import(" that are NOT preceded by "__hook_"
    let mut real_import_count = 0;
    for (i, _) in result.char_indices() {
        if result[i..].starts_with("import(") {
            if i < 7 || !result[..i].ends_with("__hook_") {
                real_import_count += 1;
            }
        }
    }
    
    let has_hook_import = result.contains("__hook_import(");
    
    println!("real import( count: {}", real_import_count);
    println!("Contains __hook_import(: {}", has_hook_import);
    
    // Find the relevant section
    if let Some(idx) = result.find("loadData") {
        let start = idx.saturating_sub(50);
        let end = (idx + 1000).min(result.len());
        println!("\n=== loadData function (around line) ===");
        println!("{}", &result[start..end]);
    }
    
    assert!(has_hook_import, "Dynamic import should be transformed to __hook_import");
    assert!(real_import_count <= 1, "import() calls in code should be converted (only the one in <p> tag should remain)");
}
