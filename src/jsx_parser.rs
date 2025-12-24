/// Minimal JSX to JavaScript transpiler
/// Converts JSX syntax to __hook_jsx_runtime.jsx() calls
/// Supports: elements, props, children, fragments, spreads
/// Does NOT support: TypeScript, complex expressions in JSX attributes

use crate::TranspileOptions;
use anyhow::{Result, anyhow};

#[derive(Debug, Clone)]
pub struct ParseContext {
    pub source: Vec<char>,
    pub pos: usize,
    pub is_typescript: bool,
}

impl ParseContext {
    pub fn new(source: String, is_typescript: bool) -> Self {
        Self { source: source.chars().collect(), pos: 0, is_typescript }
    }

    pub fn current_char(&self) -> Option<char> {
        self.source.get(self.pos).copied()
    }

    pub fn peek(&self, offset: usize) -> Option<char> {
        self.source.get(self.pos + offset).copied()
    }

    pub fn advance(&mut self) {
        self.pos += 1;
    }

    pub fn skip_whitespace(&mut self) {
        while let Some(ch) = self.current_char() {
            if ch.is_whitespace() {
                self.advance();
            } else {
                break;
            }
        }
    }

    pub fn consume(&mut self, expected: char) -> Result<()> {
        if self.current_char() == Some(expected) {
            self.advance();
            Ok(())
        } else {
            Err(anyhow!("Expected '{}' at position {}", expected, self.pos))
        }
    }

    pub fn slice(&self, start: usize, end: usize) -> String {
        self.source[start..end].iter().collect()
    }
}

/// Main transpiler entry point
pub fn transpile_jsx(source: &str, opts: &TranspileOptions) -> Result<String> {
    if !opts.is_typescript {
        // Strict JavaScript mode: No TypeScript allowed
        // We'll run a quick check for TS-only syntax
        check_for_typescript_syntax(source)?;
    }

    let source = if opts.is_typescript {
        strip_typescript(source)?
    } else {
        source.to_string()
    };

    let mut ctx = ParseContext::new(source, opts.is_typescript);
    let mut output = String::new();
    
    while ctx.pos < ctx.source.len() {
        let ch = ctx.current_char();
        
        // Handle strings to avoid transpiling JSX inside them
        if ch == Some('"') || ch == Some('\'') || ch == Some('`') {
            let quote = ch.unwrap();
            output.push(quote);
            ctx.advance();
            while let Some(c) = ctx.current_char() {
                output.push(c);
                if c == '\\' {
                    ctx.advance();
                    if let Some(next) = ctx.current_char() {
                        output.push(next);
                        ctx.advance();
                    }
                    continue;
                }
                
                if c == quote {
                    ctx.advance();
                    break;
                }
                
                // Handle template literal interpolation
                if quote == '`' && c == '$' && ctx.peek(1) == Some('{') {
                    output.push('{');
                    ctx.advance(); // consume $
                    ctx.advance(); // consume {
                    let expr = parse_js_expression(&mut ctx, '}')?;
                    ctx.consume('}')?;
                    let transpiled_expr = transpile_jsx(&expr, opts)?;
                    output.push_str(&transpiled_expr);
                    output.push('}');
                    continue;
                }
                
                ctx.advance();
            }
            continue;
        }

        // Handle comments
        if ch == Some('/') {
            if ctx.peek(1) == Some('/') {
                output.push_str("//");
                ctx.advance();
                ctx.advance();
                while let Some(c) = ctx.current_char() {
                    output.push(c);
                    ctx.advance();
                    if c == '\n' {
                        break;
                    }
                }
                continue;
            } else if ctx.peek(1) == Some('*') {
                output.push_str("/*");
                ctx.advance();
                ctx.advance();
                while let Some(c) = ctx.current_char() {
                    if c == '*' && ctx.peek(1) == Some('/') {
                        output.push_str("*/");
                        ctx.advance();
                        ctx.advance();
                        break;
                    }
                    output.push(c);
                    ctx.advance();
                }
                continue;
            }
        }

        if ch == Some('<') && is_jsx_start(&ctx) {
            let jsx_code = parse_jsx_element(&mut ctx)?;
            output.push_str(&jsx_code);
        } else {
            // Pass through non-JSX code as-is
            if let Some(ch) = ctx.current_char() {
                output.push(ch);
            }
            ctx.advance();
        }
    }
    
    Ok(output)
}

pub fn strip_typescript(source: &str) -> Result<String> {
    let mut ctx = ParseContext::new(source.to_string(), true);
    let mut output = String::new();
    
    while ctx.pos < ctx.source.len() {
        let ch = match ctx.current_char() {
            Some(c) => c,
            None => break,
        };
        
        // Handle strings
        if ch == '"' || ch == '\'' || ch == '`' {
            let quote = ch;
            output.push(quote);
            ctx.advance();
            while let Some(c) = ctx.current_char() {
                output.push(c);
                ctx.advance();
                if c == '\\' {
                    if let Some(c2) = ctx.current_char() {
                        output.push(c2);
                        ctx.advance();
                    }
                } else if c == quote {
                    break;
                }
            }
            continue;
        }
        
        // Handle comments
        if ch == '/' {
            if ctx.peek(1) == Some('/') {
                while let Some(c) = ctx.current_char() {
                    output.push(c);
                    ctx.advance();
                    if c == '\n' { break; }
                }
                continue;
            } else if ctx.peek(1) == Some('*') {
                while let Some(c) = ctx.current_char() {
                    output.push(c);
                    ctx.advance();
                    if c == '*' && ctx.current_char() == Some('/') {
                        output.push('/');
                        ctx.advance();
                        break;
                    }
                }
                continue;
            }
        }

        // Handle keywords
        if ch.is_alphabetic() {
            let start = ctx.pos;
            while let Some(c) = ctx.current_char() {
                if c.is_alphanumeric() || c == '_' {
                    ctx.advance();
                } else {
                    break;
                }
            }
            let word = ctx.slice(start, ctx.pos);
            if word == "interface" || word == "enum" {
                // Skip the name
                ctx.skip_whitespace();
                while let Some(c) = ctx.current_char() {
                    if c.is_alphanumeric() || c == '_' { ctx.advance(); }
                    else { break; }
                }
                ctx.skip_whitespace();
                if ctx.current_char() == Some('{') {
                    ctx.advance();
                    let _ = parse_js_expression(&mut ctx, '}');
                    ctx.consume('}').ok();
                }
                continue;
            } else if word == "type" {
                // Check if it's 'type name =' or just a variable named 'type'
                let saved_pos = ctx.pos;
                ctx.skip_whitespace();
                let mut is_type_decl = false;
                if let Some(c) = ctx.current_char() {
                    if c.is_alphabetic() {
                        while let Some(c2) = ctx.current_char() {
                            if c2.is_alphanumeric() || c2 == '_' { ctx.advance(); }
                            else { break; }
                        }
                        ctx.skip_whitespace();
                        if ctx.current_char() == Some('=') {
                            is_type_decl = true;
                        }
                    }
                }
                
                if is_type_decl {
                    let _ = parse_js_expression(&mut ctx, ';');
                    ctx.consume(';').ok();
                    continue;
                } else {
                    ctx.pos = saved_pos;
                }
            } else if word == "as" {
                // Only treat as 'as' if followed by a type-looking thing
                let saved_pos = ctx.pos;
                ctx.skip_whitespace();
                if let Some(c) = ctx.current_char() {
                    if c.is_alphabetic() || c == '{' || c == '[' {
                        skip_type_at_pos(&mut ctx);
                        output.push(' ');
                        continue;
                    }
                }
                ctx.pos = saved_pos;
            } else if word == "public" || word == "private" || word == "protected" || word == "readonly" || word == "abstract" {
                // Check if it's a modifier or a variable
                let saved_pos = ctx.pos;
                ctx.skip_whitespace();
                if let Some(c) = ctx.current_char() {
                    if c.is_alphabetic() {
                        // Likely a modifier, skip it
                        continue;
                    }
                }
                ctx.pos = saved_pos;
            }
            output.push_str(&word);
            continue;
        }
        
        // Handle type annotations
        if ch == ':' {
            let saved_pos = ctx.pos;
            ctx.advance();
            ctx.skip_whitespace();
            if let Some(_) = ctx.current_char() {
                // Heuristic: if it looks like a type, skip it.
                let type_start = ctx.pos;
                let mut word = String::new();
                while let Some(c) = ctx.current_char() {
                    if c.is_alphanumeric() || c == '_' { 
                        word.push(c);
                        ctx.advance();
                    } else { break; }
                }
                
                let is_builtin = match word.as_str() {
                    "string" | "number" | "boolean" | "any" | "void" | "unknown" | "never" | "object" => true,
                    _ => false
                };
                
                let is_type = is_builtin || (word.len() > 0 && word.chars().next().unwrap().is_uppercase());
                
                if is_type {
                    // It looks like a type! Skip until terminator
                    ctx.pos = type_start;
                    skip_type_at_pos(&mut ctx);
                    output.push(' ');
                    continue;
                } else {
                    ctx.pos = saved_pos;
                }
            } else {
                ctx.pos = saved_pos;
            }
        }
        
        // Handle generics
        if ch == '<' && !is_jsx_start(&ctx) {
             let saved_pos = ctx.pos;
             ctx.advance();
             skip_type_at_pos(&mut ctx);
             if ctx.current_char() == Some('>') {
                 ctx.advance();
                 output.push(' ');
                 continue;
             }
             ctx.pos = saved_pos;
        }

        // Handle non-null assertion
        if ch == '!' && ctx.peek(1).map_or(false, |c| !c.is_alphanumeric() && c != '=' && c != '!' && !c.is_whitespace()) {
             // Likely a non-null assertion, skip it
             ctx.advance();
             continue;
        }

        if let Some(c) = ctx.current_char() {
            output.push(c);
            ctx.advance();
        }
    }
    
    let output = output;
    if source.len() > 0 && output.len() == 0 {
         // This would be weird
    }
    Ok(output)
}

fn check_for_typescript_syntax(source: &str) -> Result<()> {
    let mut ctx = ParseContext::new(source.to_string(), false);
    
    while ctx.pos < ctx.source.len() {
        let ch = match ctx.current_char() {
            Some(c) => c,
            None => break,
        };
        
        // Handle strings to skip them
        if ch == '"' || ch == '\'' || ch == '`' {
            let quote = ch;
            ctx.advance();
            while let Some(c) = ctx.current_char() {
                ctx.advance();
                if c == '\\' {
                    ctx.advance();
                } else if c == quote {
                    break;
                }
            }
            continue;
        }
        
        // Handle comments
        if ch == '/' {
            if ctx.peek(1) == Some('/') {
                while let Some(c) = ctx.current_char() {
                    ctx.advance();
                    if c == '\n' { break; }
                }
                continue;
            } else if ctx.peek(1) == Some('*') {
                while let Some(c) = ctx.current_char() {
                    ctx.advance();
                    if c == '*' && ctx.current_char() == Some('/') {
                        ctx.advance();
                        break;
                    }
                }
                continue;
            }
        }

        // Handle JSX elements - skip over them entirely since keywords in JSX text are not code
        if ch == '<' && is_jsx_start(&ctx) {
            skip_jsx_element(&mut ctx)?;
            continue;
        }

        // Handle keywords
        if ch.is_alphabetic() {
            let start = ctx.pos;
            while let Some(c) = ctx.current_char() {
                if c.is_alphanumeric() || c == '_' {
                    ctx.advance();
                } else {
                    break;
                }
            }
            let word = ctx.slice(start, ctx.pos);
            
            // Only flag keywords if they're actual standalone words (not part of larger identifiers)
            // Check that the character before was not alphanumeric or underscore
            let has_valid_prefix = if start == 0 {
                true
            } else {
                let prev_char = ctx.source.get(start - 1).copied();
                match prev_char {
                    Some(c) if c.is_alphanumeric() || c == '_' => false,
                    _ => true,
                }
            };
            
            if !has_valid_prefix {
                // This word is part of a larger identifier, not a keyword
                continue;
            }
            
            if word == "type" {
                // Distinguish between `type Foo =` (TS) and property names like `type:` inside objects/JSX text.
                let mut looks_like_type_alias = false;
                let saved = ctx.pos;
                ctx.skip_whitespace();
                if let Some(c) = ctx.current_char() {
                    if c.is_alphabetic() {
                        while let Some(c2) = ctx.current_char() {
                            if c2.is_alphanumeric() || c2 == '_' { ctx.advance(); } else { break; }
                        }
                        ctx.skip_whitespace();
                        if ctx.current_char() == Some('=') {
                            looks_like_type_alias = true;
                        }
                    }
                }
                ctx.pos = saved;
                if looks_like_type_alias {
                    return Err(anyhow!("Unexpected TypeScript syntax '{}' at position {}", word, start));
                }
                continue;
            }
                // Note: 'as' is valid ES6 syntax in import/export statements like "import { x as y }"
                // Only reject it if used for TypeScript type assertions (handled separately below)
                if word == "interface" || word == "enum" || 
               word == "public" || word == "private" || word == "protected" || word == "readonly" {
                return Err(anyhow!("Unexpected TypeScript syntax '{}' at position {}", word, start));
            }
            continue;
        }

        // Check for type annotations (colon but NOT object literal/destructuring)
        if ch == ':' {
            let saved_pos = ctx.pos;
            // A colon is TS if it's NOT in an object literal or destructuring.
            // This is hard to detect perfectly without a full parser.
            // But we can look at the preceding context or following.
            // Actually, in JS, a colon only appears in:
            // 1. { key: value }
            // 2. label: statement
            // 3. ternary ? true : false
            // 4. switch case:
            
            // Heuristic: If it's followed by a type-looking thing and NOT followed by something that looks like an object value or ternary branch.
            // Let's simplify: if it looks like ': string', ': number', etc.
            ctx.advance();
            ctx.skip_whitespace();
            if ctx.current_char().is_some() {
                let mut word = String::new();
                while let Some(c) = ctx.current_char() {
                    if c.is_alphanumeric() || c == '_' {
                        word.push(c);
                        ctx.advance();
                    } else { break; }
                }

                let is_builtin = matches!(word.as_str(),
                    "string" | "number" | "boolean" | "any" | "void" | "unknown" | "never" | "object"
                );

                // Check the next non-whitespace character to reduce false positives (e.g. JSX text like "Status: Ready")
                let mut peek_pos = ctx.pos;
                while let Some(c) = ctx.source.get(peek_pos) {
                    if c.is_whitespace() { peek_pos += 1; continue; }
                    break;
                }
                let next_non_ws = ctx.source.get(peek_pos).copied();
                let type_terminated = matches!(next_non_ws, Some(',') | Some(';') | Some('=') | Some(')') | Some('>') | Some('{') | Some('}') | Some('|') | Some('&'));

                if (is_builtin || (!word.is_empty() && word.chars().next().unwrap().is_uppercase())) && type_terminated {
                     return Err(anyhow!("Unexpected TypeScript type annotation at position {}", saved_pos));
                }
            }
            ctx.pos = saved_pos;
        }

        // Handle generics (e.g., <T>)
        if ch == '<' && !is_jsx_start(&ctx) {
             // If it's not JSX and it's < something >, it might be a generic
             let saved_pos = ctx.pos;
             ctx.advance();
             let mut word = String::new();
             while let Some(c) = ctx.current_char() {
                 if c.is_alphanumeric() || c == '_' {
                     word.push(c);
                     ctx.advance();
                 } else { break; }
             }
             if word.len() > 0 && ctx.current_char() == Some('>') {
                  return Err(anyhow!("Unexpected TypeScript generic at position {}", saved_pos));
             }
             ctx.pos = saved_pos;
        }

        ctx.advance();
    }
    Ok(())
}

/// Skip an entire JSX element, including all its content and children
/// Assumes ctx is at the '<' of a JSX element
fn skip_jsx_element(ctx: &mut ParseContext) -> Result<()> {
    ctx.consume('<')?;
    
    // Handle fragments <>...</>
    if ctx.current_char() == Some('>') {
        ctx.advance();
        return skip_jsx_children(ctx, "");
    }
    
    // Skip tag name
    while let Some(ch) = ctx.current_char() {
        if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
            ctx.advance();
        } else {
            break;
        }
    }
    
    // Skip attributes/props
    while ctx.current_char() != Some('>') && ctx.current_char() != Some('/') {
        ctx.skip_whitespace();
        
        if ctx.current_char() == Some('>') || ctx.current_char() == Some('/') {
            break;
        }
        
        // Skip prop name
        while let Some(ch) = ctx.current_char() {
            if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == ':' {
                ctx.advance();
            } else {
                break;
            }
        }
        
        ctx.skip_whitespace();
        
        // Skip prop value if it exists
        if ctx.current_char() == Some('=') {
            ctx.advance();
            ctx.skip_whitespace();
            
            if ctx.current_char() == Some('"') || ctx.current_char() == Some('\'') || ctx.current_char() == Some('`') {
                let quote = ctx.current_char().unwrap();
                ctx.advance();
                while let Some(c) = ctx.current_char() {
                    ctx.advance();
                    if c == '\\' {
                        ctx.advance();
                    } else if c == quote {
                        break;
                    }
                }
            } else if ctx.current_char() == Some('{') {
                // Skip {expr} prop value
                ctx.advance();
                let mut depth = 1;
                while let Some(ch) = ctx.current_char() {
                    if ch == '{' {
                        depth += 1;
                    } else if ch == '}' {
                        depth -= 1;
                        if depth == 0 {
                            ctx.advance();
                            break;
                        }
                    } else if ch == '"' || ch == '\'' || ch == '`' {
                        let q = ch;
                        ctx.advance();
                        while let Some(c) = ctx.current_char() {
                            ctx.advance();
                            if c == '\\' {
                                ctx.advance();
                            } else if c == q {
                                break;
                            }
                        }
                        continue;
                    }
                    ctx.advance();
                }
            }
        }
    }
    
    // Check for self-closing tag
    if ctx.current_char() == Some('/') {
        ctx.advance();
        ctx.consume('>')?;
        return Ok(());
    }
    
    // Consume opening >
    ctx.consume('>')?;
    
    // Get the tag name to match closing tag
    // We need to parse it from before, but for now we'll just skip children until we find a closing tag
    // This is a simplified approach - we scan backwards to find the tag name
    let mut tag_name = String::new();
    let mut tag_pos = ctx.pos.saturating_sub(1);
    
    // Go back from the > we just consumed
    while tag_pos > 0 && ctx.source[tag_pos] != '<' {
        tag_pos -= 1;
    }
    
    if tag_pos < ctx.pos && ctx.source[tag_pos] == '<' {
        tag_pos += 1; // Skip the <
        while tag_pos < ctx.source.len() {
            let c = ctx.source[tag_pos];
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                tag_name.push(c);
                tag_pos += 1;
            } else {
                break;
            }
        }
    }
    
    skip_jsx_children(ctx, &tag_name)
}

/// Skip JSX children until the closing tag is found
fn skip_jsx_children(ctx: &mut ParseContext, _parent_tag: &str) -> Result<()> {
    loop {
        ctx.skip_whitespace();
        
        // Check for closing tag
        if ctx.current_char() == Some('<') && ctx.peek(1) == Some('/') {
            ctx.advance(); // <
            ctx.advance(); // /
            
            // Skip closing tag name
            while let Some(ch) = ctx.current_char() {
                if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                    ctx.advance();
                } else {
                    break;
                }
            }
            
            ctx.skip_whitespace();
            ctx.consume('>')?;
            break;
        }
        
        // Check for nested JSX element
        if ctx.current_char() == Some('<') {
            skip_jsx_element(ctx)?;
            continue;
        }
        
        // Check for JS expression {expr}
        if ctx.current_char() == Some('{') {
            ctx.advance();
            let mut depth = 1;
            while let Some(ch) = ctx.current_char() {
                if ch == '{' {
                    depth += 1;
                } else if ch == '}' {
                    depth -= 1;
                    if depth == 0 {
                        ctx.advance();
                        break;
                    }
                } else if ch == '"' || ch == '\'' || ch == '`' {
                    let q = ch;
                    ctx.advance();
                    while let Some(c) = ctx.current_char() {
                        ctx.advance();
                        if c == '\\' {
                            ctx.advance();
                        } else if c == q {
                            break;
                        }
                    }
                    continue;
                }
                ctx.advance();
            }
            continue;
        }
        
        // Skip text content
        while let Some(ch) = ctx.current_char() {
            if ch == '<' || ch == '{' {
                break;
            }
            ctx.advance();
        }
        
        // Check if we're at the end
        if ctx.pos >= ctx.source.len() {
            break;
        }
    }
    
    Ok(())
}

fn skip_type_at_pos(ctx: &mut ParseContext) {
    let mut depth = 0;
    let mut seen_chars = false;
    while let Some(ch) = ctx.current_char() {
        if depth == 0 && (ch == ',' || ch == ';' || ch == '=' || (seen_chars && ch == '{')) {
            break;
        }
        if ch == '<' || ch == '{' || ch == '[' || ch == '(' {
            depth += 1;
            ctx.advance();
            seen_chars = true;
        } else if ch == '>' || ch == '}' || ch == ']' || ch == ')' {
            if depth == 0 { 
                break; 
            }
            depth -= 1;
            ctx.advance();
            seen_chars = true;
        } else {
            if !ch.is_whitespace() {
                seen_chars = true;
            }
            ctx.advance();
        }
    }
}

/// Main transpiler entry point

fn is_jsx_start(ctx: &ParseContext) -> bool {
    if ctx.current_char() != Some('<') {
        return false;
    }

    // Always treat </ as JSX start (closing tag)
    if ctx.peek(1) == Some('/') {
        return true;
    }

    // Heuristic: if preceded by an alphanumeric character, it's likely a generic function call
    // e.g., useState<T> or f<T>. JSX tags are usually preceded by whitespace, operators, or brackets.
    if ctx.pos > 0 {
        if let Some(&prev) = ctx.source.get(ctx.pos - 1) {
            if prev.is_alphanumeric() || prev == '_' || prev == '$' {
                return false;
            }
        }
    }

    match ctx.peek(1) {
        Some(ch) if ch.is_alphabetic() => {
            let mut i = 1;
            while let Some(c) = ctx.peek(i) {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                    i += 1;
                } else {
                    break;
                }
            }
            let mut j = i;
            while let Some(c) = ctx.peek(j) {
                if c.is_whitespace() {
                    j += 1;
                } else {
                    break;
                }
            }
            let peek_j = ctx.peek(j);
            let res = match peek_j {
                Some('>') => {
                    // Heuristic: if followed by '(', it's likely a generic arrow function <T>(x: T) => ...
                    if ctx.peek(j + 1) == Some('(') {
                        false
                    } else {
                        true
                    }
                }
                Some('/') => true,
                Some(c) if c.is_alphabetic() => {
                    // Check if it's an attribute name or part of a type
                    // Heuristic: attributes are usually followed by = or another attribute or >
                    // If it's a type like <User | null>, we'll see | which is handled by the next case
                    true
                }
                _ => {
                    // If we see something like <User | or <User & or <User [, it's a generic
                    false
                }
            };
            res
        }
        Some('>') | Some('/') => true,
        _ => false,
    }
}

fn is_custom_component(tag: &str) -> bool {
    if tag.is_empty() {
        return false;
    }
    let first_char = tag.chars().next().unwrap();
    first_char.is_uppercase() || tag.contains('.')
}

fn parse_jsx_element(ctx: &mut ParseContext) -> Result<String> {
    ctx.consume('<')?;
    
    // Handle fragments <>...</>
    if ctx.current_char() == Some('>') {
        ctx.advance();
        return parse_fragment(ctx);
    }
    
    // Handle closing tag (shouldn't happen at top level, but handle gracefully)
    if ctx.current_char() == Some('/') {
        return Err(anyhow!("Unexpected closing tag at position {}", ctx.pos));
    }
    
    // Parse tag name
    let tag_start = ctx.pos;
    while let Some(ch) = ctx.current_char() {
        if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
            ctx.advance();
        } else {
            break;
        }
    }
    let tag_name = ctx.slice(tag_start, ctx.pos);
    
    ctx.skip_whitespace();
    
    // Parse props
    let props = parse_props(ctx)?;
    
    ctx.skip_whitespace();
    
    // Check for self-closing tag
    if ctx.current_char() == Some('/') {
        ctx.advance();
        ctx.consume('>')?;
        let tag_value = if is_custom_component(&tag_name) {
            tag_name
        } else {
            format!("\"{}\"", tag_name)
        };
        return Ok(format!(
            "__hook_jsx_runtime.jsx({}, {})",
            tag_value,
            props
        ));
    }
    
    ctx.consume('>')?;
    
    // Parse children
    let children = parse_children(ctx, &tag_name)?;
    
    // Build jsx call
    let tag_value = if is_custom_component(&tag_name) {
        tag_name.clone()
    } else {
        format!("\"{}\"", tag_name)
    };

    let jsx_call = if children.is_empty() {
        format!(
            "__hook_jsx_runtime.jsx({}, {})",
            tag_value,
            props
        )
    } else {
        // Add children to props object without spread syntax
        let props_with_children = if props == "{}" {
            format!("{{ children: [{}] }}", children.join(", "))
        } else {
            let inner = props.trim_start_matches('{').trim_end_matches('}').trim();
            if inner.is_empty() {
                format!("{{ children: [{}] }}", children.join(", "))
            } else {
                format!("{{ {}, children: [{}] }}", inner, children.join(", "))
            }
        };
        format!(
            "__hook_jsx_runtime.jsx({}, {})",
            tag_value,
            props_with_children
        )
    };
    
    Ok(jsx_call)
}

fn parse_fragment(ctx: &mut ParseContext) -> Result<String> {
    let children = parse_children(ctx, "")?;
    
    let jsx_call = if children.is_empty() {
        "__hook_jsx_runtime.jsx('div', {})".to_string()
    } else {
        format!(
            "__hook_jsx_runtime.jsx('div', {{ children: [{}] }})",
            children.join(", ")
        )
    };
    
    Ok(jsx_call)
}

fn parse_props(ctx: &mut ParseContext) -> Result<String> {
    let mut props = Vec::new();
    
    while ctx.current_char() != Some('>') && ctx.current_char() != Some('/') {
        ctx.skip_whitespace();
        
        if ctx.current_char() == Some('>') || ctx.current_char() == Some('/') {
            break;
        }
        
        // Handle spread props {...obj}
        if ctx.current_char() == Some('{') && ctx.peek(1) == Some('.') && ctx.peek(2) == Some('.') {
            ctx.advance(); // {
            ctx.advance(); // .
            ctx.advance(); // .
            ctx.advance(); // .
            
            let expr = parse_js_expression(ctx, '}')?;
            ctx.consume('}')?;
            props.push(format!("...{}", expr.trim()));
            continue;
        }
        
        // Parse prop name
        let name_start = ctx.pos;
        while let Some(ch) = ctx.current_char() {
            if ch.is_alphanumeric() || ch == '-' || ch == '_' {
                ctx.advance();
            } else {
                break;
            }
        }
        let prop_name = ctx.slice(name_start, ctx.pos);
        
        ctx.skip_whitespace();
        
        // Check for prop value
        if ctx.current_char() == Some('=') {
            ctx.advance();
            ctx.skip_whitespace();
            
            let value = if ctx.current_char() == Some('"') || ctx.current_char() == Some('\'') {
                parse_string_literal(ctx)?
            } else if ctx.current_char() == Some('{') {
                ctx.advance();
                let expr = parse_js_expression(ctx, '}')?;
                ctx.consume('}')?;
                // Recursively transpile any JSX that appears inside expressions
                transpile_jsx(&expr, &TranspileOptions { is_typescript: ctx.is_typescript })?
            } else {
                return Err(anyhow!("Expected prop value at position {}", ctx.pos));
            };
            
            props.push(format!("{}: {}", prop_name, value));
        } else {
            if !prop_name.is_empty() {
                // Boolean prop (no value means true)
                props.push(format!("{}: true", prop_name));
            } else if let Some(ch) = ctx.current_char() {
                // Skip invalid character to avoid infinite loop
                if ch != '>' && ch != '/' {
                    ctx.advance();
                }
            }
        }
        
        ctx.skip_whitespace();
    }
    
    if props.is_empty() {
        Ok("{}".to_string())
    } else {
        Ok(format!("{{ {} }}", props.join(", ")))
    }
}

fn parse_children(ctx: &mut ParseContext, parent_tag: &str) -> Result<Vec<String>> {
    let mut children = Vec::new();
    
    loop {
        ctx.skip_whitespace();
        
        // Check for closing tag
        if ctx.current_char() == Some('<') && ctx.peek(1) == Some('/') {
            ctx.advance(); // <
            ctx.advance(); // /
            
            // Parse closing tag name
            let close_start = ctx.pos;
            while let Some(ch) = ctx.current_char() {
                if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                    ctx.advance();
                } else {
                    break;
                }
            }
            let close_name = ctx.slice(close_start, ctx.pos);
            
            ctx.skip_whitespace();
            ctx.consume('>')?;
            
            // Verify closing tag matches (or is fragment)
            if !parent_tag.is_empty() && close_name != parent_tag {
                return Err(anyhow!(
                    "Mismatched closing tag: expected </{}>  but got </{}> at position {}",
                    parent_tag, close_name, ctx.pos
                ));
            }
            
            break;
        }
        
        // Check for nested JSX element
        if ctx.current_char() == Some('<') && is_jsx_start(ctx) {
            let child_jsx = parse_jsx_element(ctx)?;
            children.push(child_jsx);
            continue;
        }
        
        // Check for JS expression {expr}
        if ctx.current_char() == Some('{') {
            ctx.advance();
            let expr = parse_js_expression(ctx, '}')?;
            ctx.consume('}')?;

            // Recursively transpile any JSX that appears inside expressions
            let transpiled_expr = transpile_jsx(&expr, &TranspileOptions { is_typescript: ctx.is_typescript })?;
            children.push(transpiled_expr);
            continue;
        }
        
        // Parse text content
        let text_start = ctx.pos;
        while let Some(ch) = ctx.current_char() {
            if ch == '<' || ch == '{' {
                break;
            }
            ctx.advance();
        }
        
        let text_slice = ctx.slice(text_start, ctx.pos);
        let text = text_slice.trim().to_string();
        if !text.is_empty() {
            children.push(format!("\"{}\"", escape_string(&text)));
        }
        
        // If we haven't moved, we're at end of input without proper closing
        if ctx.pos == text_start {
            if ctx.pos >= ctx.source.len() {
                return Err(anyhow!("Unexpected end of input while parsing children for tag <{}>. Current position: {}, Total length: {}", parent_tag, ctx.pos, ctx.source.len()));
            }
            break;
        }
    }
    
    Ok(children)
}

fn parse_string_literal(ctx: &mut ParseContext) -> Result<String> {
    let quote = ctx.current_char().unwrap();
    ctx.advance();
    
    let start = ctx.pos;
    while let Some(ch) = ctx.current_char() {
        if ch == quote {
            break;
        }
        if ch == '\\' {
            ctx.advance(); // Skip escaped char
        }
        ctx.advance();
    }
    
    let content = ctx.slice(start, ctx.pos);
    ctx.consume(quote)?;
    
    Ok(format!("\"{}\"", escape_string(&content)))
}

fn parse_js_expression(ctx: &mut ParseContext, terminator: char) -> Result<String> {
    let start = ctx.pos;
    let mut depth = 0;
    let mut in_string = false;
    let mut string_char = ' ';
    
    while let Some(ch) = ctx.current_char() {
        if in_string {
            if ch == '\\' {
                ctx.advance();
                ctx.advance();
                continue;
            }
            if ch == string_char {
                in_string = false;
            }
            ctx.advance();
            continue;
        }
        
        if ch == '"' || ch == '\'' || ch == '`' {
            in_string = true;
            string_char = ch;
            ctx.advance();
            continue;
        }
        
        if ch == '{' || ch == '[' || ch == '(' {
            depth += 1;
            ctx.advance();
            continue;
        }
        
        if ch == '}' || ch == ']' || ch == ')' {
            if depth == 0 && ch == terminator {
                break;
            }
            depth -= 1;
            ctx.advance();
            continue;
        }
        
        if depth == 0 && ch == terminator {
            break;
        }
        
        ctx.advance();
    }
    
    Ok(ctx.slice(start, ctx.pos))
}

fn escape_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

/// Extract import metadata and feature flags from source
pub fn extract_imports_and_features(source: &str) -> (Vec<crate::ImportMetadata>, bool, bool) {
    let mut imports = Vec::new();
    let has_jsx = source.contains('<') && (source.contains("/>") || source.contains("</"));
    let has_dynamic_import = source.contains("import(");

    for raw_line in source.lines() {
        let line = raw_line.trim_start();
        if !line.starts_with("import ") { continue; }

        // Strip trailing semicolon
        let line = line.trim_end_matches(';').trim_end();

        // Quick skip for side-effect imports: import 'x'
        if let Some(spec) = parse_side_effect_specifier(line) {
            imports.push(crate::ImportMetadata { source: spec.to_string(), kind: determine_import_kind(spec), bindings: Vec::new() });
            continue;
        }

        // Forms we handle (simple):
        // import { a, b as c } from 'mod'
        // import * as NS from "mod"
        // import Default from 'mod'
        // Note: combined default + named not currently needed by tests

        if let Some((named_clause, spec)) = parse_named_import(line) {
            let mut bindings = Vec::new();
            for part in named_clause.split(',') {
                let p = part.trim();
                if p.is_empty() { continue; }
                let segs: Vec<&str> = p.split(" as ").collect();
                let name = segs[0].trim();
                if !name.is_empty() {
                    bindings.push(crate::ImportBinding { binding_type: crate::ImportBindingType::Named, name: name.to_string(), alias: segs.get(1).map(|s| s.trim().to_string()) });
                }
            }
            imports.push(crate::ImportMetadata { source: spec.to_string(), kind: determine_import_kind(spec), bindings });
            continue;
        }

        if let Some((ns_name, spec)) = parse_namespace_import(line) {
            imports.push(crate::ImportMetadata { source: spec.to_string(), kind: determine_import_kind(spec), bindings: vec![crate::ImportBinding { binding_type: crate::ImportBindingType::Namespace, name: ns_name.to_string(), alias: None }] });
            continue;
        }

        if let Some((default_name, spec)) = parse_default_import(line) {
            imports.push(crate::ImportMetadata { source: spec.to_string(), kind: determine_import_kind(spec), bindings: vec![crate::ImportBinding { binding_type: crate::ImportBindingType::Default, name: default_name.to_string(), alias: None }] });
            continue;
        }
    }

    (imports, has_jsx, has_dynamic_import)
}

fn parse_quoted_spec(s: &str) -> Option<&str> {
    let bytes = s.as_bytes();
    let first = *bytes.get(0)?;
    if first != b'"' && first != b'\'' { return None; }
    let quote = first as char;
    let mut i = 1;
    while i < bytes.len() {
        let c = bytes[i] as char;
        if c == '\\' { i += 2; continue; }
        if c == quote { return Some(&s[1..i]); }
        i += 1;
    }
    None
}

fn parse_side_effect_specifier(line: &str) -> Option<&str> {
    // import 'module'
    if let Some(idx) = line.find("import ") {
        let rest = line[idx + 7..].trim_start();
        if rest.starts_with('\'') || rest.starts_with('"') {
            return parse_quoted_spec(rest);
        }
    }
    None
}

fn parse_named_import(line: &str) -> Option<(&str, &str)> {
    // import { a, b as c } from 'mod'
    if !line.starts_with("import ") { return None; }
    let after = &line[7..];
    let after = after.trim_start();
    if !after.starts_with('{') { return None; }
    let close = after.find('}')?;
    let named = &after[1..close];
    let rest = after[close+1..].trim_start();
    if !rest.starts_with("from ") { return None; }
    let spec = rest[5..].trim_start();
    let spec = parse_quoted_spec(spec)?;
    Some((named, spec))
}

fn parse_namespace_import(line: &str) -> Option<(&str, &str)> {
    // import * as NS from 'mod'
    if !line.starts_with("import ") { return None; }
    let mut rest = &line[7..];
    rest = rest.trim_start();
    if !rest.starts_with("* as ") { return None; }
    rest = &rest[5..];
    // read identifier
    let mut end = 0;
    for ch in rest.chars() {
        if ch.is_alphanumeric() || ch == '_' || ch == '$' { end += ch.len_utf8(); } else { break; }
    }
    if end == 0 { return None; }
    let name = &rest[..end];
    rest = rest[end..].trim_start();
    if !rest.starts_with("from ") { return None; }
    let spec = &rest[5..];
    let spec = parse_quoted_spec(spec)?;
    Some((name, spec))
}

fn parse_default_import(line: &str) -> Option<(&str, &str)> {
    // import Default from 'mod'
    if !line.starts_with("import ") { return None; }
    let mut rest = &line[7..];
    rest = rest.trim_start();
    // read identifier
    let mut end = 0;
    for ch in rest.chars() {
        if ch.is_alphanumeric() || ch == '_' || ch == '$' { end += ch.len_utf8(); } else { break; }
    }
    if end == 0 { return None; }
    let name = &rest[..end];
    rest = rest[end..].trim_start();
    if !rest.starts_with("from ") { return None; }
    let spec = &rest[5..];
    let spec = parse_quoted_spec(spec)?;
    Some((name, spec))
}

fn determine_import_kind(source: &str) -> crate::ImportKind {
    // List of Node.js builtin modules
    let builtins = [
        "assert", "buffer", "child_process", "cluster", "crypto", "dgram",
        "dns", "domain", "events", "fs", "http", "https", "net", "os",
        "path", "punycode", "querystring", "readline", "stream", "string_decoder",
        "timers", "tls", "tty", "url", "util", "v8", "vm", "zlib",
    ];
    
    // Check if it's a builtin
    let module_name = source.split('/').next().unwrap_or(source);
    if builtins.contains(&module_name) || source.starts_with("node:") {
        return crate::ImportKind::Builtin;
    }
    
    // Special packages that need rewriting
    let special_packages = [
        "react",
        "react-dom",
        "@clevertree/meta",
        "@clevertree/file-renderer",
        "@clevertree/helpers",
        "@clevertree/markdown",
    ];
    
    if special_packages.contains(&source) {
        return crate::ImportKind::SpecialPackage;
    }
    
    // Everything else is a module
    crate::ImportKind::Module
}

/// Transpile JSX and return metadata about the module
pub fn transpile_jsx_with_metadata(source: &str, opts: &TranspileOptions) -> Result<(String, crate::TranspileMetadata)> {
    let code = transpile_jsx(source, opts)?;
    let (imports, has_jsx, has_dynamic_import) = extract_imports_and_features(source);
    
    let metadata = crate::TranspileMetadata {
        imports,
        has_jsx,
        has_dynamic_import,
        version: crate::version().to_string(),
    };
    
    Ok((code, metadata))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_element() {
        let input = "<div></div>";
        let output = transpile_jsx(input, &TranspileOptions::default()).unwrap();
        assert_eq!(output, "__hook_jsx_runtime.jsx(\"div\", {})");
    }

    #[test]
    fn test_self_closing() {
        let input = "<div />";
        let output = transpile_jsx(input, &TranspileOptions::default()).unwrap();
        assert_eq!(output, "__hook_jsx_runtime.jsx(\"div\", {})");
    }

    #[test]
    fn test_with_props() {
        let input = r#"<div className="foo" id="bar"></div>"#;
        let output = transpile_jsx(input, &TranspileOptions::default()).unwrap();
        assert!(output.contains("className: \"foo\""));
        assert!(output.contains("id: \"bar\""));
    }

    #[test]
    fn test_destructuring_fix() {
        let src = r#"
export default function () {
  const theme = {
    colors: { primary: '#2196F3' }
  };
  const { colors: { primary } } = theme;
  return <div style={{ color: primary }} />;
}
"#;
        let out = transpile_jsx(src, &TranspileOptions { is_typescript: true }).expect("Should transpile correctly");
        assert!(out.contains("const { colors: { primary } } = theme;"), "Destructuring should be preserved");
    }

    #[test]
    fn test_generic_fix() {
        let src = r#"const f = <T>(x: T) => x;"#;
        let err = transpile_jsx(src, &TranspileOptions::default());
        assert!(err.is_err(), "JS mode should reject TS generics");

        let out = transpile_jsx(src, &TranspileOptions { is_typescript: true }).expect("Should transpile correctly in TS mode");
        assert!(!out.contains("__hook_jsx_runtime.jsx"), "Should NOT transpile generic as JSX");
    }

    #[test]
    fn test_ts_mode_stripping() {
        let src = r#"
interface User { name: string; }
const user: User = { name: "Ari" };
const f = <T>(x: T): T => x;
const element = <div user={user as any} />;"#;
        let out = transpile_jsx(src, &TranspileOptions { is_typescript: true }).expect("Should transpile correctly");
        assert!(!out.contains("interface User"), "Should strip interface");
        assert!(!out.contains(": User"), "Should strip type annotation");
        assert!(!out.contains("<T>"), "Should strip generic");
        assert!(!out.contains("as any"), "Should strip 'as any'");
        assert!(out.contains("__hook_jsx_runtime.jsx"), "Should transpile JSX");
    }

    #[test]
    fn test_js_mode_rejections() {
        let src_interface = "interface User { name: string; }";
        let err = transpile_jsx(src_interface, &TranspileOptions { is_typescript: false });
        assert!(err.is_err(), "Should reject interface in JS mode");

        let src_type = "type MyNum = number;";
        let err = transpile_jsx(src_type, &TranspileOptions { is_typescript: false });
        assert!(err.is_err(), "Should reject type in JS mode");

        let src_annotation = "const x: number = 5;";
        let err = transpile_jsx(src_annotation, &TranspileOptions { is_typescript: false });
        assert!(err.is_err(), "Should reject type annotation in JS mode");

        let src_destructuring = "const { colors: { primary } } = theme;";
        let out = transpile_jsx(src_destructuring, &TranspileOptions { is_typescript: false }).expect("Should allow destructuring");
        assert!(out.contains("const { colors: { primary } } = theme;"), "Should preserve destructuring in JS mode");
    }

    #[test]
    fn test_with_children() {
        let input = "<div>Hello World</div>";
        let output = transpile_jsx(input, &TranspileOptions::default()).unwrap();
        assert!(output.contains("children"));
        assert!(output.contains("Hello World"));
    }

    #[test]
    fn test_nested_elements() {
        let input = "<div><span>Nested</span></div>";
        let output = transpile_jsx(input, &TranspileOptions::default()).unwrap();
        assert!(output.contains("div"));
        assert!(output.contains("span"));
        assert!(output.contains("Nested"));
    }

    #[test]
    fn test_fragment() {
        let input = "<>Fragment content</>";
        let output = transpile_jsx(input, &TranspileOptions::default()).unwrap();
        assert!(output.contains("Fragment content"));
    }

}
