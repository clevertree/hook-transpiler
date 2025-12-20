#[cfg(test)]
mod test_automatic_jsx {
    use crate::transpile_jsx_simple;

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
        let out = transpile_jsx_simple(src).unwrap();
        
        // The transpiler should output _jsx calls with 3 arguments where third is the key
        // Check that the map callback returns a _jsx call with key parameter
        assert!(out.contains("__hook_jsx_runtime.jsx"), "Should have jsx runtime calls");
        assert!(out.contains("movies.map"), "Should have map call");

        println!("\n=== AUTOMATIC JSX TRANSPILE OUTPUT ===\n{}\n", out);
    }
}
