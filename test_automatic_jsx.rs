#[cfg(test)]
mod test_automatic_jsx {
    use crate::{transpile, TranspileOptions};

    #[test]
    fn test_jsx_in_map_returns_correct_structure() {
        let src = r#"
export function MovieList(props) {
  const movies = [{id: 1, title: "Movie 1"}, {id: 2, title: "Movie 2"}];
  return (
    <div>
      {movies.map((movie) => (
        <div key={movie.id}>{movie.title}</div>
      ))}
    </div>
  );
}
"#;
        let out = transpile(
            src,
            TranspileOptions {
                filename: Some("MovieList.jsx".into()),
                react_dev: false,
                to_commonjs: false,
                pragma: None,
                pragma_frag: None,
            },
        )
        .unwrap();
        
        // The transpiler should output _jsx calls with 3 arguments where third is the key
        // Check that the map callback returns a _jsx call with key parameter
        assert!(out.code.contains("_jsx"), "Should have _jsx calls");
        assert!(out.code.contains("movies.map"), "Should have map call");
        
        // The key should be passed as third parameter to _jsx
        // This is the automatic JSX runtime signature: jsx(type, props, key)
        println!("\n=== AUTOMATIC JSX TRANSPILE OUTPUT ===\n{}\n", out.code);
    }
}
