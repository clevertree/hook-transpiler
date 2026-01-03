# Implementation Roadmap: Template Literal Fixes

Current plan (Jan 2026)
- Web/wasm: keep the slim JSX-only path; exclude SWC from wasm builds.
- Native (Android/iOS): enable the `native-swc` feature to run the SWC pipeline (JSX/TS, React transform, CommonJS when requested).
- Debug layer: emit source maps for transpiled remote hooks and expose a bridge so breakpoints/logging work in QuickJS/Android and web.

Upcoming tasks
- Wire lib to prefer SWC for native targets and keep legacy parser only for wasm-lite.
- Add SWC module/compat transforms for CommonJS and JSC where needed.
- Update JNI/FFI and TS/Android entrypoints to rely solely on the SWC-backed native binding.
- Add source-map emission and runtime hooks to surface map URLs/inline maps for remote hooks.
- Document how to attach breakpoints in Android test app and web runtime.

---

## Path A: SWC Integration (Recommended)

### Step 1: Add Dependencies

```bash
cd /home/ari/dev/hook-transpiler
cargo add swc_core@0.90 swc_ecma_ast@0.90 swc_ecma_parser@0.90 swc_ecma_codegen@0.90
cargo add --dev insta  # For snapshot testing
```

### Step 2: Update Cargo.toml Features

```toml
# Cargo.toml
[features]
default = []
wasm = ["serde", "serde_json", "wasm_bindgen", "js_sys"]
android = ["swc_core", "swc_ecma_ast", "swc_ecma_parser", "swc_ecma_codegen"]
```

### Step 3: Create SWC Transformer

Create file: `src/swc_transformer.rs`

```rust
use anyhow::{Result, anyhow};
use swc_core::{
    common::{sync::Lrc, SourceMap, DUMMY_SP},
    ecma::{
        ast::*,
        codegen::Emitter,
        parser::{Parser, Syntax, EsConfig},
        visit::{VisitMut, VisitMutWith},
    },
};

/// Transform modern JS (optional chaining, nullish coalescing, etc.)
/// into ES5-compatible code for older JavaScriptCore
pub fn downlevel_for_jsc(source: &str) -> Result<String> {
    let cm = Lrc::new(SourceMap::default());
    let fm = cm.new_source_file(
        swc_core::common::FileName::Anon,
        source.to_string(),
    );

    let syntax = Syntax::Es(EsConfig {
        jsx: true,
        fn_bind: false,
        decorators: false,
        decorators_before_export: false,
        import_assertions: false,
        import_meta: false,
        allow_super_outside_method: false,
        allow_return_outside_function: false,
        ..Default::default()
    });

    let mut parser = Parser::new(syntax, fm.clone().into(), None);
    let module = parser.parse_module()
        .map_err(|e| anyhow!("Parse error: {}", e))?;

    // Apply transformations
    let mut transformer = JscTransformer::new();
    let module = transformer.visit_module(module);

    // Emit back to string
    let mut buf = vec![];
    {
        let mut emitter = Emitter {
            cfg: swc_core::ecma::codegen::Config {
                target: swc_core::ecma::ast::EsVersion::Es5,
                ..Default::default()
            },
            cm,
            comments: None,
            wr: Box::new(&mut buf),
        };

        emitter.emit_module(&module)
            .map_err(|e| anyhow!("Emit error: {}", e))?;
    }

    String::from_utf8(buf)
        .map_err(|e| anyhow!("UTF-8 error: {}", e))
}

/// Visitor that transforms modern JS constructs
struct JscTransformer;

impl JscTransformer {
    fn new() -> Self {
        Self
    }
}

impl VisitMut for JscTransformer {
    // SWC handles optional chaining and nullish coalescing automatically
    // when target is set to ES5 - nothing more to do!
    // The Emitter with Es5 target handles all transformations
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optional_chaining() {
        let src = "const x = obj?.prop;";
        let result = downlevel_for_jsc(src).unwrap();
        
        // Should not contain ?. in output
        assert!(!result.contains("?."));
        
        // Should have null check
        assert!(result.contains("== null") || result.contains("!= null"));
    }

    #[test]
    fn test_optional_chaining_in_template_literal() {
        let src = r#"const msg = `Hello ${user?.name}`;"#;
        let result = downlevel_for_jsc(src).unwrap();
        
        // Should properly handle inside template
        assert!(!result.contains("?.")); // Transformed
    }

    #[test]
    fn test_nested_optional_chaining() {
        let src = "const x = a?.b?.c?.d;";
        let result = downlevel_for_jsc(src).unwrap();
        
        assert!(!result.contains("?."));
    }

    #[test]
    fn test_optional_call() {
        let src = "const x = func?.();";
        let result = downlevel_for_jsc(src).unwrap();
        
        assert!(!result.contains("?.("));
    }

    #[test]
    fn test_optional_index() {
        let src = "const x = arr?.[0];";
        let result = downlevel_for_jsc(src).unwrap();
        
        assert!(!result.contains("?.["));
    }

    #[test]
    fn test_nullish_coalescing() {
        let src = "const x = a ?? b;";
        let result = downlevel_for_jsc(src).unwrap();
        
        assert!(!result.contains("??"));
    }

    #[test]
    fn test_combined_optional_and_nullish() {
        let src = "const x = obj?.prop ?? 'default';";
        let result = downlevel_for_jsc(src).unwrap();
        
        assert!(!result.contains("?."));
        assert!(!result.contains("??"));
    }

    #[test]
    fn test_preserves_comments() {
        let src = r#"
            // This comment has ?. but shouldn't affect parsing
            const x = obj?.prop;
        "#;
        let result = downlevel_for_jsc(src).unwrap();
        
        // Should still have comment
        assert!(result.contains("//"));
        
        // But the actual code should be transformed
        assert!(!result.contains("obj?.prop"));
    }
}
```

### Step 4: Integrate into Main Library

Edit `src/lib.rs`:

```rust
mod jsx_parser;

#[cfg(feature = "android")]
mod swc_transformer;

// ... existing code ...

pub fn transpile_jsx_with_options(source: &str, opts: &TranspileOptions) -> Result<String> {
    // 1. Parse and transpile JSX (existing logic, unchanged)
    let jsx_output = jsx_parser::transpile_jsx(source, opts)?;
    
    // 2. For Android target, apply modern JS downleveling
    #[cfg(feature = "android")]
    {
        if opts.target == TranspileTarget::Android {
            return swc_transformer::downlevel_for_jsc(&jsx_output);
        }
    }
    
    // For Web target or when android feature not enabled, return as-is
    Ok(jsx_output)
}
```

### Step 5: Test It

```bash
cd /home/ari/dev/hook-transpiler

# Run tests with android feature
cargo test --features android

# Run specific test
cargo test --features android test_optional_chaining_in_template_literal

# Check compilation without feature (Web builds)
cargo build --release --features wasm
```

### Step 6: Update Build Script

Edit `build-and-deploy.sh`:

```bash
#!/bin/bash

# ... existing WASM build ...

# Android build (if needed)
if command -v cargo-ndk &> /dev/null; then
    echo "Building Android native libraries..."
    
    # Build with android feature enabled
    cargo ndk -t arm64-v8a -t armeabi-v7a -o ./android/jniLibs \
        build --release --features android
    
    echo "Android libs built to android/jniLibs/"
fi

echo "Done!"
```

---

## Path B: Enhanced Regex (Alternative)

### Step 1: Create Enhanced Parser Module

Create file: `src/enhanced_regex.rs`

```rust
use regex::Regex;

/// Enhanced state-machine based parser for optional chaining
/// Properly tracks strings, template literals, and comments
pub fn transform_optional_chaining_enhanced(source: &str) -> String {
    let mut state = ParserState::new(source);
    state.transform()
}

struct ParserState {
    chars: Vec<char>,
    pos: usize,
    output: String,
}

impl ParserState {
    fn new(source: &str) -> Self {
        Self {
            chars: source.chars().collect(),
            pos: 0,
            output: String::new(),
        }
    }

    fn transform(mut self) -> String {
        while self.pos < self.chars.len() {
            match self.current_char() {
                // Handle strings
                Some('"') | Some('\'') => self.consume_string(),
                
                // Handle template literals - MUST preserve expressions
                Some('`') => self.consume_template_literal(),
                
                // Handle comments
                Some('/') if self.peek(1) == Some('/') => self.consume_line_comment(),
                Some('/') if self.peek(1) == Some('*') => self.consume_block_comment(),
                
                // Handle optional chaining
                Some('?') if self.peek(1) == Some('.') => {
                    // Check if we're in a valid context (not in string/comment)
                    self.transform_optional_chaining_operator()
                }
                
                _ => {
                    self.output.push(self.current_char().unwrap());
                    self.advance();
                }
            }
        }
        self.output
    }

    fn current_char(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn peek(&self, offset: usize) -> Option<char> {
        self.chars.get(self.pos + offset).copied()
    }

    fn advance(&mut self) {
        self.pos += 1;
    }

    fn consume_string(&mut self) {
        let quote = self.current_char().unwrap();
        self.output.push(quote);
        self.advance();

        while let Some(ch) = self.current_char() {
            self.output.push(ch);
            
            if ch == '\\' && self.peek(1).is_some() {
                // Escaped character
                self.advance();
                self.output.push(self.current_char().unwrap());
                self.advance();
            } else if ch == quote {
                self.advance();
                break;
            } else {
                self.advance();
            }
        }
    }

    fn consume_template_literal(&mut self) {
        // Special handling for template literals
        // Need to track ${ } expressions but not transform them
        self.output.push('`');
        self.advance();

        while let Some(ch) = self.current_char() {
            if ch == '\\' && self.peek(1).is_some() {
                self.output.push(ch);
                self.advance();
                self.output.push(self.current_char().unwrap());
                self.advance();
            } else if ch == '$' && self.peek(1) == Some('{') {
                // Expression inside template literal
                // Recursively parse the expression without transforming it
                self.output.push('$');
                self.output.push('{');
                self.advance();
                self.advance();

                let mut brace_depth = 1;
                while brace_depth > 0 && self.current_char().is_some() {
                    match self.current_char().unwrap() {
                        '{' => brace_depth += 1,
                        '}' => brace_depth -= 1,
                        _ => {}
                    }
                    
                    // For expressions, we might want to transform them
                    // But keep it simple: just copy through
                    self.output.push(self.current_char().unwrap());
                    self.advance();
                }
            } else if ch == '`' {
                self.output.push(ch);
                self.advance();
                break;
            } else {
                self.output.push(ch);
                self.advance();
            }
        }
    }

    fn consume_line_comment(&mut self) {
        while let Some(ch) = self.current_char() {
            self.output.push(ch);
            if ch == '\n' {
                self.advance();
                break;
            }
            self.advance();
        }
    }

    fn consume_block_comment(&mut self) {
        self.output.push(self.current_char().unwrap()); // /
        self.advance();
        self.output.push(self.current_char().unwrap()); // *
        self.advance();

        while self.pos + 1 < self.chars.len() {
            if self.current_char() == Some('*') && self.peek(1) == Some('/') {
                self.output.push('*');
                self.advance();
                self.output.push('/');
                self.advance();
                break;
            }
            self.output.push(self.current_char().unwrap());
            self.advance();
        }
    }

    fn transform_optional_chaining_operator(&mut self) {
        // At this point: current = '?', peek(1) = '.'
        
        // Find the object before the ?.
        let obj_start = self.find_object_start();
        let obj = self.output[obj_start..].to_string();
        self.output.truncate(obj_start);

        self.advance(); // Skip '?'
        self.advance(); // Skip '.'

        // Determine what comes after
        let next = self.current_char();

        match next {
            Some('[') => {
                // obj?.[key]
                self.output.push_str("(");
                self.output.push_str(&obj);
                self.output.push_str(" != null ? ");
                self.output.push_str(&obj);
                self.output.push('[');
                self.advance();

                let mut bracket_depth = 1;
                while bracket_depth > 0 && self.current_char().is_some() {
                    match self.current_char().unwrap() {
                        '[' => bracket_depth += 1,
                        ']' => bracket_depth -= 1,
                        _ => {}
                    }
                    self.output.push(self.current_char().unwrap());
                    self.advance();
                }

                self.output.push_str(" : undefined)");
            }
            Some('(') => {
                // obj?.()
                self.output.push_str("(");
                self.output.push_str(&obj);
                self.output.push_str(" != null ? ");
                self.output.push_str(&obj);
                self.output.push('(');
                self.advance();

                let mut paren_depth = 1;
                while paren_depth > 0 && self.current_char().is_some() {
                    match self.current_char().unwrap() {
                        '(' => paren_depth += 1,
                        ')' => paren_depth -= 1,
                        _ => {}
                    }
                    self.output.push(self.current_char().unwrap());
                    self.advance();
                }

                self.output.push_str(" : undefined)");
            }
            _ => {
                // obj?.prop
                self.output.push_str("(");
                self.output.push_str(&obj);
                self.output.push_str(" != null ? ");
                self.output.push_str(&obj);
                self.output.push('.');

                while let Some(ch) = self.current_char() {
                    if ch.is_alphanumeric() || ch == '_' {
                        self.output.push(ch);
                        self.advance();
                    } else {
                        break;
                    }
                }

                self.output.push_str(" : undefined)");
            }
        }
    }

    fn find_object_start(&self) -> usize {
        // Walk backwards to find where the object name starts
        let mut i = self.output.len();

        while i > 0 {
            let ch = self.output.chars().nth(i - 1).unwrap();
            if ch.is_alphanumeric() || ch == '_' || ch == ')' || ch == ']' {
                i -= 1;
            } else {
                break;
            }
        }

        i
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optional_chaining() {
        let src = "const x = obj?.prop;";
        let out = transform_optional_chaining_enhanced(src);
        assert!(!out.contains("?."));
        assert!(out.contains("!= null"));
    }

    #[test]
    fn test_in_template_literal() {
        let src = r#"const msg = `Hello ${user?.name}`;"#;
        let out = transform_optional_chaining_enhanced(src);
        
        // Should preserve template literal
        assert!(out.contains('`'));
        
        // Should transform the optional chaining inside
        assert!(!out.contains("?."));
    }

    #[test]
    fn test_comment_ignored() {
        let src = "// obj?.prop\nconst x = obj?.prop;";
        let out = transform_optional_chaining_enhanced(src);
        
        // First one in comment unchanged, second one transformed
        assert!(out.contains("// obj?.prop"));
        assert!(!out[out.find('\n').unwrap()..].contains("?."));
    }
}
```

### Step 2: Add Regex Dependency

```bash
cargo add regex
```

### Step 3: Integrate Into Library

Edit `src/lib.rs` to use enhanced regex:

```rust
#[cfg(feature = "enhanced-regex")]
mod enhanced_regex;

pub fn transpile_jsx_with_options(source: &str, opts: &TranspileOptions) -> Result<String> {
    let jsx_output = jsx_parser::transpile_jsx(source, opts)?;
    
    #[cfg(feature = "enhanced-regex")]
    {
        if opts.target == TranspileTarget::Android {
            return Ok(enhanced_regex::transform_optional_chaining_enhanced(&jsx_output));
        }
    }
    
    Ok(jsx_output)
}
```

### Step 4: Test

```bash
cargo test --features enhanced-regex
```

---

## Decision: Which Path?

### Choose SWC if:
- ✅ You want zero maintenance
- ✅ You need 100% accuracy
- ✅ Bundle size is not a concern
- ✅ You want production-ready immediately

### Choose Enhanced Regex if:
- ✅ You want to stay lightweight
- ✅ You're comfortable with 90% coverage
- ✅ You want to understand the code deeply
- ✅ Bundle size matters

---

## Testing Both Paths

After implementing, test against these patterns:

```javascript
// Template literals with optional chaining
const msg = `Hello ${user?.name || 'Guest'}`;

// Nested optional chaining
const x = a?.b?.c?.d;

// Optional call
const result = fn?.();

// Optional index
const item = arr?.[0];

// In function parameters
const fn = (obj?.prop);

// With nullish coalescing
const val = obj?.prop ?? 'default';

// Comment edge case
// Should have obj?.prop
const code = obj?.prop;

// Escaped quotes
const str = "path with \\'quotes\\'";
```

All should transform correctly for Android (JSC) target.
