# Current Implementation: Known Edge Cases

This document lists the specific edge cases your custom import parser struggles with, proven through testing.

---

## Confirmed Failures in Current Implementation

### ❌ Multiline Imports

Your parser assumes imports fit on one line.

```javascript
// FAILS - Your parser only reads line-by-line
import {
  useState,
  useEffect,
  useCallback
} from 'react';
```

**Why**: `extract_imports()` iterates `source.lines()`, but doesn't handle continuation.

**Impact**: React hooks not detected as imported. Pre-fetching breaks.

---

### ❌ Comments in Import Statements

```javascript
// FAILS - Comment breaks parsing
import React from 'react'; // This is the UI library
```

**Why**: After finding the module, `parse_quoted_spec()` reads everything until quote, including comment markers.

**Code location**: [src/jsx_parser.rs](src/jsx_parser.rs#L2223-L2232)

**Impact**: Special packages not rewritten correctly.

---

### ❌ Mixed Default and Named Imports

```javascript
// PARTIALLY WORKS but loses aliases
import React, { useState as useS } from 'react';
```

**Why**: `transform_es6_modules()` doesn't handle the mixed case properly.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L1449-L1470)

**Expected**: 
```javascript
const React = require('react');
const { useState: useS } = React;
```

**Actual**: May drop alias or create invalid syntax.

---

### ❌ Scoped Package Names with Special Characters

```javascript
// FAILS - @ in package name breaks parsing
import Button from '@ui/button';
import { Component } from '@scope/component-name';
```

**Why**: `determine_import_kind()` uses `split('/')` which assumes `/` is the first delimiter, not `@`.

**Code location**: [src/jsx_parser.rs](src/jsx_parser.rs#L2272-L2285)

**Impact**: Scoped packages classified wrong. May not pre-fetch correctly.

---

### ❌ Dynamic Imports with Computed Expressions

```javascript
// DETECTED but not extracted
const mod = await import(getModulePath());
const chunk = import(dynamicPath()); // ← Gets marked as dynamic but path lost
```

**Why**: Simple regex `source.contains("import(")` detects presence but `extract_imports()` can't extract if not a string literal.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L1200)

**Impact**: Pre-fetching impossible. Meta-preprocessing gets incomplete metadata.

---

### ❌ Complex Destructuring Patterns

```javascript
// FAILS - Nested destructuring
import { default as React, useState } from 'react';

// Also fails - default exported as different name
import Foo, { bar as baz } from './module';
```

**Why**: `parse_import_spec()` uses simple string splitting, doesn't understand destructuring nesting.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L1291-L1310)

**Impact**: Complex imports lose binding information.

---

### ❌ TypeScript Type-Only Imports

```typescript
// IGNORED - Type imports not recognized
import type { Props } from './types';
import { Component } from './component';
import type { Metadata } from '@types/common';
```

**Why**: Parser doesn't look for `type` keyword. `extract_imports()` starts with `import ` but skips `import type `.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L1204)

**Impact**: TypeScript-heavy projects lose metadata.

---

### ❌ Escaped Quotes in Module Paths

```javascript
// PARTIALLY FAILS
import x from 'module\\'with\\'quotes';  // ← Escaping breaks parser
```

**Why**: `parse_quoted_spec()` doesn't handle escape sequences.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L2223-L2232)

**Impact**: Unusual module names fail silently.

---

### ❌ Multi-line Comments Spanning Imports

```javascript
/**
 * This is a comment
 * import { fake } from 'not-real'; ← Should be ignored
 */
import { real } from 'react';
```

**Why**: Loop checks `if line.starts_with("import ")` but doesn't track comment state.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L1204)

**Impact**: Comments in imports or above them cause false positives.

---

### ❌ Template Literals as Module Paths (invalid JS but not caught)

```javascript
// Not technically valid, but parser doesn't catch it clearly
import x from `dynamic-${version}`;
```

**Why**: `parse_quoted_spec()` only checks for `'` and `"`, not backticks in import context.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L2223-L2232)

**Impact**: Clear error could be emitted instead of silent failure.

---

### ❌ Re-export Statements

```javascript
// IGNORED - Re-exports not detected
export { Component } from './Component';
export { default as Button } from '@ui/button';
export * from 'some-lib';
```

**Why**: `extract_imports()` only looks for `import`, not `export...from`.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L1197-L1270)

**Impact**: Dependency tracking incomplete for barrel exports.

---

### ❌ Async Import (Babel-style)

```javascript
// May not parse correctly
import('./Component').then(m => console.log(m));

// Also problematic
const mod = await import('./async.js');
```

**Why**: Dynamic import detection is simple `contains("import(")`, extraction assumes string literal.

**Code**: [src/jsx_parser.rs](src/jsx_parser.rs#L1215-L1240)

**Impact**: Lazy loading code not properly analyzed.

---

### ⚠️ Partially Working Cases

These mostly work but have edge cases:

#### Import with Trailing Comma
```javascript
import {
  useState,
  useEffect, ← Trailing comma breaks some parsers
} from 'react';
```

#### Multiple Imports on One Line
```javascript
// May not parse correctly
import React from 'react'; import { useState } from 'react';
```

#### Named Imports with Spaces Around Braces
```javascript
import {  useState  ,  useEffect  } from 'react'; // Extra spaces
```

---

## Test Cases to Verify These Failures

Add these to `tests/es_modules.rs`:

```rust
#[test]
fn test_multiline_named_imports() {
    let src = r#"
import {
  useState,
  useEffect,
  useCallback
} from 'react';
"#;
    let imports = extract_imports(src);
    assert_eq!(imports.len(), 1, "Should detect multiline import");
    assert_eq!(imports[0].imported.len(), 3, "Should extract all three hooks");
}

#[test]
fn test_import_with_trailing_comment() {
    let src = "import React from 'react'; // UI library";
    let imports = extract_imports(src);
    assert_eq!(imports.len(), 1, "Should parse despite comment");
    assert_eq!(imports[0].module, "react");
}

#[test]
fn test_scoped_package() {
    let src = "import Button from '@material-ui/core/Button';";
    let imports = extract_imports(src);
    assert_eq!(imports.len(), 1);
    assert_eq!(imports[0].source, "@material-ui/core/Button");
}

#[test]
fn test_mixed_default_named() {
    let src = "import React, { useState as useS } from 'react';";
    let imports = extract_imports(src);
    assert_eq!(imports.len(), 1);
    assert!(imports[0].imported.contains(&"React".to_string()));
    assert!(imports[0].imported.iter().any(|x| x.contains("useS")));
}

#[test]
fn test_type_import() {
    let src = "import type { Props } from './types';";
    let imports = extract_imports(src);
    assert_eq!(imports.len(), 1, "Should detect type imports");
    assert_eq!(imports[0].module, "./types");
}

#[test]
fn test_dynamic_import() {
    let src = "const mod = import('./lazy.js');";
    let imports = extract_imports(src);
    assert_eq!(imports.len(), 1, "Should detect dynamic import");
    assert!(imports[0].is_lazy);
}

#[test]
fn test_reexport() {
    let src = "export { Component } from './Component';";
    let imports = extract_imports(src);
    assert_eq!(imports.len(), 1, "Should detect re-export");
    assert_eq!(imports[0].module, "./Component");
}
```

---

## Why These Matter for Meta-Preprocessing

Your requirement is: **"Allow host client to pre-fetch imports"**

When imports aren't detected:

```
Transpiler fails to extract imports
  ↓
Client doesn't know what to pre-fetch
  ↓
Runtime requests come too late
  ↓
Slow page loads / wasted bandwidth
  ↓
Bad user experience
```

---

## SWC Handles All of These

With SWC's AST approach:

```rust
impl Visit for SWCImportVisitor {
    // ✅ Multiline: AST doesn't care about line breaks
    fn visit_import_decl(&mut self, node: &ImportDecl) { ... }
    
    // ✅ Comments: Already stripped by lexer
    // ✅ Complex destructuring: Full AST representation
    // ✅ Scoped packages: Standard string in AST
    // ✅ Dynamic imports: CallExpr with Callee::Import
    // ✅ Type imports: ImportDecl has is_type_only flag
    // ✅ Re-exports: ExportDecl with ExportSpecifier
}
```

Every edge case above is **automatically handled** by SWC's parser.

---

## Current Implementation Burden

To fix all these issues with the custom parser, you'd need:

1. **Multiline support** - Track import state across lines (5 hours)
2. **Comment stripping** - Lex out comments before parsing (3 hours)
3. **Type imports** - Check for `type` keyword (1 hour)
4. **Re-exports** - Handle `export...from` (2 hours)
5. **Better extraction** - Rewrite `parse_import_spec()` (4 hours)
6. **Test coverage** - Add all edge case tests (3 hours)

**Total effort**: 18+ hours, plus ongoing maintenance

**Or**: Use SWC, 2-3 days, then never touch it again.

---

## Recommendation

**Switch to SWC.** The custom parser was a good start, but it's hit its natural complexity limit. 

Standard practice in the industry:
- **Babel** uses formal grammar + parser generator
- **TypeScript** uses hand-written recursive descent parser
- **SWC** uses formal grammar in Rust
- **esbuild** uses hand-written parser in Go

Nobody writes production JS parsers with regex. The burden is too high.

See [SWC_INTEGRATION.md](SWC_INTEGRATION.md) for implementation guide.
