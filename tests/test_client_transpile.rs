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
    let has_import_call = result.contains("import(");
    let has_hook_import = result.contains("__hook_import(");
    
    println!("Contains import(: {}", has_import_call);
    println!("Contains __hook_import(: {}", has_hook_import);
    
    // Find the relevant section
    if let Some(idx) = result.find("loadData") {
        let start = idx.saturating_sub(50);
        let end = (idx + 500).min(result.len());
        println!("\n=== loadData function (around line) ===");
        println!("{}", &result[start..end]);
    }
    
    assert!(has_hook_import, "Dynamic import should be transformed to __hook_import");
    assert!(!has_import_call, "import() calls should be converted");
}
