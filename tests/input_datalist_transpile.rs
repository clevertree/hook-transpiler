#[cfg(test)]
mod tests {
    use relay_hook_transpiler::{transpile_jsx_with_options, TranspileOptions};

    #[test]
    fn transpiles_input_and_datalist() {
        let source = r#"
            export default function Test() {
                return (
                    <div>
                        <input type="text" list="cities" id="city-input" />
                        <datalist id="cities">
                            <option value="Boston" />
                            <option value="New York" />
                        </datalist>
                    </div>
                );
            }
        "#;

        let options = TranspileOptions {
            filename: Some("test.jsx".to_string()),
            ..Default::default()
        };

        let result = transpile_jsx_with_options(source, &options).unwrap();
        println!("Transpiled output:\n{}", result);
        
        // Verify it contains the expected elements
        assert!(result.contains("\"input\""));
        assert!(result.contains("\"datalist\""));
        assert!(result.contains("\"option\""));
        assert!(result.contains("list:"));
        assert!(result.contains("id: \"city-input\""));
    }
}
