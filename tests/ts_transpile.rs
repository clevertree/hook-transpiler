use relay_hook_transpiler::{transpile_jsx_simple, transpile_jsx_with_options, TranspileOptions};

#[test]
fn test_ts_type_annotations_off() {
    let src = r#"
        const x: string = "hello";
        const y: number = 42;
        function greet(name: string): string {
            return `Hello, ${name}`;
        }
        <div>{greet(x)}</div>
    "#;
    // Flag off: should reject TS type annotations
    let err = transpile_jsx_simple(src);
    assert!(err.is_err(), "JS mode should reject TS annotations");
}

#[test]
fn test_ts_type_annotations_on() {
    let src = r#"
        const x: string = "hello";
        const y: number = 42;
        function greet(name: string): string {
            return `Hello, ${name}`;
        }
        <div>{greet(x)}</div>
    "#;
    // Flag on: SHOULD strip TS
    let out = transpile_jsx_with_options(src, &TranspileOptions { is_typescript: true }).expect("should transpile");
    println!("OUTPUT (ON):\n{}", out);
    
    assert!(!out.contains(": string"));
    assert!(out.contains("const x") && out.contains("= \"hello\""));
    assert!(out.contains("const y") && out.contains("= 42"));
    assert!(out.contains("function greet(name"));
    assert!(out.contains("__hook_jsx_runtime.jsx(\"div\", { children: [greet(x)] })"));
}

#[test]
fn test_ts_generics() {
    let src = r#"
        const [data, setData] = useState<User | null>(null);
        const ref = useRef<HTMLDivElement>(null);
        <div>{data?.name}</div>
    "#;
    let out = transpile_jsx_with_options(src, &TranspileOptions { is_typescript: true }).expect("should transpile");
    println!("OUTPUT (GENERICS):\n{}", out);

    assert!(!out.contains("<User | null>"));
    assert!(!out.contains("<HTMLDivElement>"));
    assert!(out.contains("useState") && out.contains("(null)"));
    assert!(out.contains("useRef") && out.contains("(null)"));
}

#[test]
fn test_ts_complex_constructs() {
    let src = r#"
        interface User {
            id: number;
            name: string;
        }
        type Callback = (u: User) => void;
        enum Role { Admin, User }
        const u: User = { id: 1, name: "Ari" };
        const x = u as any;
        const y = u!.name;
        <div>{u.name}</div>
    "#;
    let out = transpile_jsx_with_options(src, &TranspileOptions { is_typescript: true }).expect("should transpile");
    println!("OUTPUT (COMPLEX):\n{}", out);

    assert!(!out.contains("interface User"));
    assert!(!out.contains("type Callback"));
    assert!(!out.contains("enum Role"));
    assert!(!out.contains(": User"));
    assert!(!out.contains("as any"));
    assert!(!out.contains("u!"));
    assert!(out.contains("const u") && out.contains("{ id: 1, name: \"Ari\" }"));
    assert!(out.contains("const x = u"));
    assert!(out.contains("const y = u.name"));
}
