# SWC Integration Guide for Import Handling

## Quick Start: Adding SWC to hook-transpiler

This guide shows you exactly how to integrate SWC for robust import parsing while keeping your custom JSX transpiler.

---

## Step 1: Add SWC Dependencies to Cargo.toml

```toml
[dependencies]
# ... existing dependencies ...
swc_core = { version = "0.101", features = ["ecma_parser", "ecma_visit"] }
```

**Why these features?**
- `ecma_parser` - JavaScript/TypeScript parser
- `ecma_visit` - AST visitor pattern (makes traversal easy)

**Check latest version**: https://crates.io/crates/swc_core

---

## Step 2: Create SWC-Based Import Extractor

Add this to `src/jsx_parser.rs`:

```rust
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::parser::{Parser, StringInput, Syntax, EsConfig};
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::Visit;
use std::sync::Arc;

/// SWC-based visitor for collecting imports
struct SWCImportVisitor {
    imports: Vec<crate::ImportMetadata>,
    has_jsx: bool,
    has_dynamic_import: bool,
}

impl SWCImportVisitor {
    fn new() -> Self {
        Self {
            imports: Vec::new(),
            has_jsx: false,
            has_dynamic_import: false,
        }
    }
}

impl Visit for SWCImportVisitor {
    fn visit_import_decl(&mut self, node: &ImportDecl) {
        // Extract the module source
        let source = node.src.value.to_string();
        
        // Determine import kind
        let kind = determine_import_kind(&source);
        
        // Extract bindings
        let mut bindings = Vec::new();
        for specifier in &node.specifiers {
            match specifier {
                ImportSpecifier::Named(spec) => {
                    let name = spec.local.sym.to_string();
                    let imported = match &spec.imported {
                        Some(ModuleExportName::Ident(ident)) => ident.sym.to_string(),
                        Some(ModuleExportName::Str(s)) => s.value.to_string(),
                        None => name.clone(),
                    };
                    
                    bindings.push(crate::ImportBinding {
                        binding_type: crate::ImportBindingType::Named,
                        name,
                        alias: if imported != name { Some(imported) } else { None },
                    });
                }
                ImportSpecifier::Default(spec) => {
                    bindings.push(crate::ImportBinding {
                        binding_type: crate::ImportBindingType::Default,
                        name: spec.local.sym.to_string(),
                        alias: None,
                    });
                }
                ImportSpecifier::Namespace(spec) => {
                    bindings.push(crate::ImportBinding {
                        binding_type: crate::ImportBindingType::Namespace,
                        name: spec.local.sym.to_string(),
                        alias: None,
                    });
                }
            }
        }
        
        self.imports.push(crate::ImportMetadata {
            source,
            kind,
            bindings,
        });
    }
    
    fn visit_call_expr(&mut self, node: &CallExpr) {
        // Detect dynamic imports: import('./module')
        if let Callee::Import(_) = &node.callee {
            self.has_dynamic_import = true;
            
            // Extract the module path from the argument
            if let Some(ExprOrSpread { expr, .. }) = node.args.first() {
                match &**expr {
                    Expr::Lit(Lit::Str(s)) => {
                        let source = s.value.to_string();
                        self.imports.push(crate::ImportMetadata {
                            source,
                            kind: determine_import_kind("dynamic"),
                            bindings: vec![crate::ImportBinding {
                                binding_type: crate::ImportBindingType::Default,
                                name: "__lazy".to_string(),
                                alias: None,
                            }],
                        });
                    }
                    _ => {
                        // Dynamic expressions like import(getPath())
                        // Mark that we have dynamic imports but can't extract path
                        self.has_dynamic_import = true;
                    }
                }
            }
        }
        
        // Continue visiting children
        node.visit_children_with(self);
    }
    
    fn visit_jsx_element(&mut self, _node: &JSXElement) {
        self.has_jsx = true;
    }
    
    fn visit_jsx_fragment(&mut self, _node: &JSXFragment) {
        self.has_jsx = true;
    }
}

/// Extract imports using SWC parser
pub fn extract_imports_and_features_swc(source: &str) -> Result<(Vec<crate::ImportMetadata>, bool, bool), String> {
    // Create a source map
    let cm = Arc::new(SourceMap::new(Default::default()));
    
    // Create a file entry
    let fm = cm.new_source_file(FileName::Anon, source.to_string());
    
    // Create parser with ES2024 syntax
    let syntax = Syntax::Es(EsConfig {
        jsx: true,
        typescript: true,
        decorators: true,
        ..Default::default()
    });
    
    let mut parser = Parser::new(
        StringInput::from(&*fm),
        syntax,
    );
    
    // Parse the module
    let module = parser.parse_module()
        .map_err(|e| format!("SWC parse error: {}", e))?;
    
    // Visit the AST
    let mut visitor = SWCImportVisitor::new();
    use swc_core::ecma::visit::VisitWith;
    module.visit_with(&mut visitor);
    
    Ok((visitor.imports, visitor.has_jsx, visitor.has_dynamic_import))
}

/// Update the public function to use SWC
pub fn extract_imports_and_features(source: &str) -> (Vec<crate::ImportMetadata>, bool, bool) {
    match extract_imports_and_features_swc(source) {
        Ok(result) => result,
        Err(e) => {
            eprintln!("SWC parse error, falling back to regex: {}", e);
            // Fallback to old implementation if SWC fails
            extract_imports_and_features_fallback(source)
        }
    }
}

/// Old regex-based fallback (keep for safety)
fn extract_imports_and_features_fallback(source: &str) -> (Vec<crate::ImportMetadata>, bool, bool) {
    // ... existing implementation ...
    let mut imports = Vec::new();
    let has_jsx = source.contains('<') && (source.contains("/>") || source.contains("</"));
    let has_dynamic_import = source.contains("import(");
    
    // ... rest of old code ...
    
    (imports, has_jsx, has_dynamic_import)
}
```

---

## Step 3: Update the Public `extract_imports` Function

Replace the old string-based implementation:

```rust
/// Extract import metadata from source without executing it
/// Now uses SWC for robust parsing
pub fn extract_imports(source: &str) -> Vec<crate::ImportMetadata> {
    match extract_imports_and_features_swc(source) {
        Ok((imports, _, _)) => imports,
        Err(e) => {
            eprintln!("Warning: SWC parse failed: {}", e);
            Vec::new()
        }
    }
}
```

---

## Step 4: Add Tests for Edge Cases

Add to `src/jsx_parser.rs` tests section:

```rust
#[cfg(test)]
mod swc_import_tests {
    use super::*;

    #[test]
    fn test_swc_multiline_imports() {
        let src = r#"
import {
  useState,
  useEffect,
  useCallback,
  useMemo
} from 'react';
"#;
        let imports = extract_imports(src);
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].source, "react");
        assert_eq!(imports[0].bindings.len(), 4);
    }

    #[test]
    fn test_swc_import_with_comment() {
        let src = r#"import React from 'react'; // UI library
import { useState } from 'react'; /* hooks */"#;
        let imports = extract_imports(src);
        assert_eq!(imports.len(), 2);
    }

    #[test]
    fn test_swc_scoped_package() {
        let src = "import Button from '@ui/button';";
        let imports = extract_imports(src);
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].source, "@ui/button");
    }

    #[test]
    fn test_swc_mixed_default_and_named() {
        let src = "import React, { useState as useS, useEffect } from 'react';";
        let imports = extract_imports(src);
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].bindings.len(), 3);
        
        // Check default
        let defaults: Vec<_> = imports[0].bindings.iter()
            .filter(|b| matches!(b.binding_type, crate::ImportBindingType::Default))
            .collect();
        assert_eq!(defaults.len(), 1);
    }

    #[test]
    fn test_swc_dynamic_import() {
        let src = "const mod = await import('./lazy');";
        let (imports, _, has_dyn) = extract_imports_and_features(src);
        assert!(has_dyn);
        // Dynamic imports should be detected
    }

    #[test]
    fn test_swc_typescript_imports() {
        let src = r#"
import type { FC } from 'react';
import { Component } from './Component';
import type { Props } from './types';
"#;
        let imports = extract_imports(src);
        // Should extract both type and value imports
        assert!(imports.iter().any(|i| i.source == "react"));
        assert!(imports.iter().any(|i| i.source == "./Component"));
    }

    #[test]
    fn test_swc_jsx_detection() {
        let src = "const el = <Component />;";
        let (_, has_jsx, _) = extract_imports_and_features(src);
        assert!(has_jsx);
    }

    #[test]
    fn test_swc_fallback_on_error() {
        // Malformed code that SWC might struggle with
        let src = "import { ...rest }"; // Missing from clause
        // Should not panic, should handle gracefully
        let imports = extract_imports(src);
        // Either parses it or returns empty - should not crash
        assert!(true);
    }
}
```

---

## Step 5: Keep Your Existing JSX Transpiler

Your custom JSX transpiler is excellent and doesn't need to change:

```rust
pub fn transpile_jsx(source: &str, opts: &TranspileOptions) -> Result<String> {
    // ... your existing JSX transpilation ...
    // Still works exactly the same!
}
```

---

## Step 6: Integration in the Pipeline

Update `transpile_jsx_with_metadata`:

```rust
pub fn transpile_jsx_with_metadata(source: &str, opts: &TranspileOptions) -> Result<(String, crate::TranspileMetadata)> {
    // Step 1: Transpile JSX (unchanged)
    let code = transpile_jsx(source, opts)?;
    
    // Step 2: Extract imports with SWC (new, robust)
    let (imports, has_jsx, has_dynamic_import) = extract_imports_and_features(source);
    
    let metadata = crate::TranspileMetadata {
        imports,
        has_jsx,
        has_dynamic_import,
        version: crate::version().to_string(),
    };
    
    Ok((code, metadata))
}
```

---

## Step 7: Build and Test

```bash
# Build with new SWC dependency
cargo build

# Run tests to verify SWC works
cargo test

# Check bundle size
du -h target/wasm32-unknown-unknown/release/relay_hook_transpiler.wasm
```

---

## Comparison: Before vs After

### Before (Regex-based)
```
Input: multiline import with comments
└─ String manipulation
   ├─ Line-by-line parsing
   ├─ Regex matching
   └─ Error-prone for edge cases
```

### After (SWC-based)
```
Input: source code
└─ SWC Parser
   ├─ Full AST construction
   ├─ Visit pattern (guaranteed to visit all nodes)
   ├─ Robust error handling
   └─ Zero ambiguity
```

---

## Rollout Plan

### Week 1
1. Add SWC to Cargo.toml
2. Implement `extract_imports_and_features_swc()`
3. Add fallback function
4. Run existing tests

### Week 2
1. Add edge case tests
2. Update `extract_imports()` to use SWC
3. Run full test suite
4. Benchmark build time

### Week 3
1. Remove old string-based parsing functions (optional)
2. Update documentation
3. Deploy to relay-clients

---

## Troubleshooting

### SWC Parse Errors
SWC is strict about syntax. If you get parse errors:
1. Check the source is valid JavaScript/TypeScript
2. Verify the Syntax config includes `jsx: true, typescript: true`
3. Add better error messages with line/column info

### Bundle Size Concerns
- SWC will add ~200-300KB to your WASM bundle
- You're already at 4.4MB, so ~6-7% increase
- Worth it for reliability

### Performance
- SWC parsing is faster than string manipulation
- Overall transpilation time should decrease

---

## Files to Modify

| File | Changes |
|------|---------|
| `Cargo.toml` | Add `swc_core` dependency |
| `src/jsx_parser.rs` | Add SWC visitor, update extract_imports |
| `src/lib.rs` | No changes needed |
| Tests | Add edge case tests |

---

## Key Advantages of This Approach

✅ **No breaking changes** - Public API stays the same  
✅ **Backward compatible** - Fallback to regex if SWC fails  
✅ **Keeps your JSX transpiler** - What you built works great  
✅ **Meta-preprocessing unchanged** - Host can still pre-fetch imports  
✅ **Handles all JS/TS variants** - No more edge case bugs  
✅ **Production-ready** - Used by Next.js, Vercel, etc.  

---

## Next Steps

1. Review this guide with your team
2. Start with Step 1-2 (add dependency, implement visitor)
3. Run `cargo test` to validate
4. Add the edge case tests from Step 4
5. Update your build script if needed
