//! Proper state machine transpiler for downleveling modern JavaScript to ES5
//! Used for Android/iOS JavaScriptCore targets which lack ES2020+ support
//!
//! This module is only compiled for non-WASM targets to keep the WASM bundle small.
//! Uses character-by-character parsing with full context awareness (strings, template literals, comments)

use anyhow::Result;

/// Transform modern JS (optional chaining, nullish coalescing, etc.)
/// into ES5-compatible code for older JavaScriptCore engines.
///
/// # Strategy
/// 1. Parse character-by-character with full state tracking
/// 2. Never transform code inside strings, template literals, or comments
/// 3. Handle optional chaining (?.) → null checks
/// 4. Handle nullish coalescing (??) → logical OR with typeof check
///
/// # Examples
/// ```ignore
/// let src = "const x = obj?.prop;";
/// let result = downlevel_for_jsc(src)?;
/// assert!(!result.contains("?."));
/// ```
pub fn downlevel_for_jsc(source: &str) -> Result<String> {
    let mut transpiler = Transpiler::new(source);
    Ok(transpiler.transpile())
}

/// Full-context parser with state tracking
struct Transpiler {
    input: Vec<char>,
    output: String,
    pos: usize,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum ParserState {
    Normal,
    InString(char),     // char is the quote type (' " `)
    InLineComment,
    InBlockComment,
}

impl Transpiler {
    fn new(input: &str) -> Self {
        Self {
            input: input.chars().collect(),
            output: String::new(),
            pos: 0,
        }
    }

    fn transpile(&mut self) -> String {
        while self.pos < self.input.len() {
            let state = self.current_state();
            
            match state {
                ParserState::Normal => self.handle_normal(),
                ParserState::InString(quote) => self.handle_string(quote),
                ParserState::InLineComment => self.handle_line_comment(),
                ParserState::InBlockComment => self.handle_block_comment(),
            }
        }
        
        self.output.clone()
    }

    fn current_state(&self) -> ParserState {
        if self.pos >= self.input.len() {
            return ParserState::Normal;
        }

        let ch = self.current_char();
        
        // Check for comment starts
        if ch == Some('/') {
            if self.peek(1) == Some('/') {
                return ParserState::InLineComment;
            }
            if self.peek(1) == Some('*') {
                return ParserState::InBlockComment;
            }
        }

        // Check for string starts
        if ch == Some('"') || ch == Some('\'') || ch == Some('`') {
            return ParserState::InString(ch.unwrap());
        }

        ParserState::Normal
    }

    fn handle_normal(&mut self) {
        let ch = self.current_char();
        
        // Check for const/let -> var
        if self.has_valid_word_prefix() {
            if ch == Some('c') && self.peek(1) == Some('o') && self.peek(2) == Some('n') && self.peek(3) == Some('s') && self.peek(4) == Some('t') && self.is_word_boundary_at(self.pos + 5) {
                self.output.push_str("var");
                self.pos += 5;
                return;
            }
            if ch == Some('l') && self.peek(1) == Some('e') && self.peek(2) == Some('t') && self.is_word_boundary_at(self.pos + 3) {
                self.output.push_str("var");
                self.pos += 3;
                return;
            }
        }

        // Check for optional chaining
        if ch == Some('?') && self.peek(1) == Some('.') {
            if self.is_optional_chaining_context() {
                self.transform_optional_chaining();
                return;
            }
        }

        // Check for nullish coalescing
        if ch == Some('?') && self.peek(1) == Some('?') {
            self.transform_nullish_coalescing();
            return;
        }

        // Normal character
        if let Some(c) = ch {
            self.output.push(c);
        }
        self.pos += 1;
    }

    fn handle_string(&mut self, quote: char) {
        let _start = self.pos;
        self.output.push(quote);
        self.pos += 1;

        // Special handling for template literals
        let is_template = quote == '`';

        while self.pos < self.input.len() {
            let ch = self.current_char();

            if ch == Some('\\') && self.peek(1).is_some() {
                // Escape sequence
                self.output.push(ch.unwrap());
                self.pos += 1;
                if let Some(next) = self.current_char() {
                    self.output.push(next);
                    self.pos += 1;
                }
                continue;
            }

            if ch == Some(quote) {
                self.output.push(quote);
                self.pos += 1;
                break;
            }

            // Template literal interpolation - transform code inside ${}
            if is_template && ch == Some('$') && self.peek(1) == Some('{') {
                self.output.push('$');
                self.output.push('{');
                self.pos += 2;

                // Parse expression inside ${ } and apply transformations
                let mut brace_depth = 1;
                while brace_depth > 0 && self.pos < self.input.len() {
                    let inner_state = self.current_state();
                    
                    match inner_state {
                        ParserState::Normal => {
                            let inner_ch = self.current_char();
                            
                            if inner_ch == Some('{') {
                                brace_depth += 1;
                                self.output.push(inner_ch.unwrap());
                                self.pos += 1;
                            } else if inner_ch == Some('}') {
                                brace_depth -= 1;
                                if brace_depth > 0 {
                                    self.output.push(inner_ch.unwrap());
                                }
                                self.pos += 1;
                            } else if inner_ch == Some('?') && self.peek(1) == Some('.') && brace_depth > 0 {
                                // Transform optional chaining inside template expression
                                if self.is_optional_chaining_context() {
                                    self.transform_optional_chaining();
                                }
                            } else if inner_ch == Some('?') && self.peek(1) == Some('?') && brace_depth > 0 {
                                // Transform nullish coalescing inside template expression
                                self.transform_nullish_coalescing();
                            } else {
                                if let Some(c) = inner_ch {
                                    self.output.push(c);
                                }
                                self.pos += 1;
                            }
                        }
                        ParserState::InString(quote_char) => {
                            // Handle nested strings in template expression
                            self.handle_string(quote_char);
                        }
                        ParserState::InLineComment => {
                            // Handle comments in template expression
                            self.handle_line_comment();
                        }
                        ParserState::InBlockComment => {
                            // Handle block comments in template expression
                            self.handle_block_comment();
                        }
                    }
                }
                
                if brace_depth == 0 {
                    self.output.push('}');
                }
                continue;
            }

            if let Some(c) = ch {
                self.output.push(c);
            }
            self.pos += 1;
        }
    }

    fn handle_line_comment(&mut self) {
        // Copy comment as-is until newline
        while self.pos < self.input.len() {
            let ch = self.current_char();
            if let Some(c) = ch {
                self.output.push(c);
                if c == '\n' {
                    self.pos += 1;
                    break;
                }
            }
            self.pos += 1;
        }
    }

    fn handle_block_comment(&mut self) {
        self.output.push('/');
        self.output.push('*');
        self.pos += 2;

        // Copy until */ is found
        while self.pos + 1 < self.input.len() {
            let ch = self.current_char();
            let next = self.peek(1);

            if let Some(c) = ch {
                self.output.push(c);
            }

            if ch == Some('*') && next == Some('/') {
                self.output.push('/');
                self.pos += 2;
                break;
            }

            self.pos += 1;
        }
    }

    fn is_optional_chaining_context(&self) -> bool {
        // Look back to see if we have a valid object reference
        // Valid: identifiers, ), ], or whitespace before ?
        let mut check_pos = self.pos as i32 - 1;

        while check_pos >= 0 && self.input[check_pos as usize].is_whitespace() {
            check_pos -= 1;
        }

        if check_pos < 0 {
            return false;
        }

        let ch = self.input[check_pos as usize];
        ch.is_alphanumeric() || ch == '_' || ch == ')' || ch == ']'
    }

    fn transform_optional_chaining(&mut self) {
        // Find the object reference before ?.
        let obj_start = self.find_object_start();
        let raw_segment = self.output[obj_start..].to_string();
        let mut obj = raw_segment.trim_end().to_string();
        let leading_ws: String = obj.chars().take_while(|c| c.is_whitespace()).collect();
        obj = obj.trim_start().to_string();
        self.output.truncate(obj_start);

        // If we accidentally captured a leading keyword (return/throw/await/yield),
        // move it back out of the transformed expression so the generated code stays valid.
        let mut keyword_prefixes: Vec<&'static str> = Vec::new();
        loop {
            let mut found = false;
            for kw in ["return", "throw", "await", "yield"].iter() {
                if let Some(rest) = obj.strip_prefix(kw) {
                    if rest.starts_with(|c: char| c.is_whitespace() || c == '(' || c == '{') {
                        keyword_prefixes.push(kw);
                        obj = rest.trim_start().to_string();
                        found = true;
                        break;
                    }
                }
            }
            if !found {
                break;
            }
        }

        self.output.push_str(&leading_ws);
        for kw in keyword_prefixes.into_iter() {
            self.output.push_str(kw);
            self.output.push(' ');
        }

        self.pos += 2; // Skip ?.

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
                self.pos += 1;

                // Copy bracket expression
                let mut depth = 1;
                while depth > 0 && self.pos < self.input.len() {
                    let ch = self.current_char().unwrap_or(' ');
                    if ch == '[' {
                        depth += 1;
                    } else if ch == ']' {
                        depth -= 1;
                    }
                    self.output.push(ch);
                    self.pos += 1;
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
                self.pos += 1;

                // Copy paren expression
                let mut depth = 1;
                while depth > 0 && self.pos < self.input.len() {
                    let ch = self.current_char().unwrap_or(' ');
                    if ch == '(' {
                        depth += 1;
                    } else if ch == ')' {
                        depth -= 1;
                    }
                    self.output.push(ch);
                    self.pos += 1;
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

                while self.pos < self.input.len() {
                    let ch = self.current_char();
                    if let Some(c) = ch {
                        if c.is_alphanumeric() || c == '_' {
                            self.output.push(c);
                            self.pos += 1;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }

                self.output.push_str(" : undefined)");
            }
        }
    }

    fn transform_nullish_coalescing(&mut self) {
        // a ?? b → (a != null ? a : b)
        // Find the left operand
        let left_end = self.find_operator_left_operand();
        let left = self.output[left_end..].trim().to_string();
        self.output.truncate(left_end);

        self.pos += 2; // Skip ??

        self.output.push_str("(");
        self.output.push_str(&left);
        self.output.push_str(" != null ? ");
        self.output.push_str(&left);
        self.output.push_str(" : ");

        // Find and copy the right operand
        while self.pos < self.input.len() {
            let ch = self.current_char();
            match ch {
                Some(';') | Some(',') | Some(')') | Some('}') | Some(']') | Some('\n') => {
                    self.output.push(')');
                    break;
                }
                Some(c) => {
                    self.output.push(c);
                    self.pos += 1;
                }
                None => {
                    self.output.push(')');
                    break;
                }
            }
        }
    }

    fn find_object_start(&self) -> usize {
        // Work in character indices (not byte len) to avoid panics with non-ASCII text
        // Handles parenthesized expressions so nested optional chains stay intact.
        let mut started = false;
        let mut paren_depth = 0; // counts both () and []

        for (idx, ch) in self.output.char_indices().rev() {
            if !started {
                if ch.is_whitespace() {
                    continue;
                }
                if ch == ')' || ch == ']' {
                    started = true;
                    paren_depth = 1;
                    continue;
                }
                if ch.is_alphanumeric() || ch == '_' {
                    started = true;
                    continue;
                }
                // Hit a boundary before we started collecting an identifier/expression
                return idx + ch.len_utf8();
            }

            match ch {
                ')' | ']' => {
                    paren_depth += 1;
                }
                '(' | '[' => {
                    if paren_depth > 0 {
                        paren_depth -= 1;
                        // We just closed the outermost wrapping pair; the object
                        // starts immediately after this bracket/paren.
                        if paren_depth == 0 {
                            return idx + ch.len_utf8();
                        }
                        continue;
                    }
                    return idx + ch.len_utf8();
                }
                _ => {
                    if paren_depth > 0 {
                        continue;
                    }
                    if ch.is_alphanumeric() || ch == '_' {
                        continue;
                    }
                    if ch.is_whitespace() {
                        return idx + ch.len_utf8();
                    }
                    return idx + ch.len_utf8();
                }
            }
        }

        0
    }

    fn find_operator_left_operand(&self) -> usize {
        let mut paren_depth = 0;
        let mut bracket_depth = 0;

        for (idx, ch) in self.output.char_indices().rev() {
            match ch {
                ')' => paren_depth += 1,
                '(' => {
                    if paren_depth > 0 {
                        paren_depth -= 1;
                    } else {
                        return idx + ch.len_utf8();
                    }
                }
                ']' => bracket_depth += 1,
                '[' => {
                    if bracket_depth > 0 {
                        bracket_depth -= 1;
                    } else {
                        return idx + ch.len_utf8();
                    }
                }
                ';' | ',' | '=' | '{' | '}' if paren_depth == 0 && bracket_depth == 0 => {
                    return idx + ch.len_utf8();
                }
                _ => {}
            }
        }
        0
    }

    fn current_char(&self) -> Option<char> {
        self.input.get(self.pos).copied()
    }

    fn peek(&self, offset: usize) -> Option<char> {
        self.input.get(self.pos + offset).copied()
    }

    fn is_word_boundary_at(&self, pos: usize) -> bool {
        match self.input.get(pos) {
            Some(c) => !c.is_alphanumeric() && *c != '_' && *c != '$',
            None => true,
        }
    }

    fn has_valid_word_prefix(&self) -> bool {
        if self.pos == 0 {
            return true;
        }
        match self.input.get(self.pos - 1) {
            Some(c) => !c.is_alphanumeric() && *c != '_' && *c != '$',
            None => true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optional_chaining_property() {
        let src = "const x = obj?.prop;";
        let result = downlevel_for_jsc(src).unwrap();
        assert!(!result.contains("?."));
        assert!(result.contains("!= null"));
    }

    #[test]
    fn test_optional_chaining_in_template_literal() {
        let src = r#"const msg = `Hello ${user?.name}`;"#;
        let result = downlevel_for_jsc(src).unwrap();
        assert!(!result.contains("?."));
        assert!(result.contains("`"));
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
    fn test_combined() {
        let src = "const x = obj?.prop ?? 'default';";
        let result = downlevel_for_jsc(src).unwrap();
        assert!(!result.contains("?."));
        assert!(!result.contains("??"));
    }

    #[test]
    fn test_in_comment_ignored() {
        let src = "// obj?.prop\nconst x = obj?.prop;";
        let result = downlevel_for_jsc(src).unwrap();
        assert!(result.contains("// obj?.prop"));
    }

    #[test]
    fn test_in_string_ignored() {
        let src = r#"const s = "obj?.prop"; const x = obj?.prop;"#;
        let result = downlevel_for_jsc(src).unwrap();
        assert!(result.contains("\"obj?.prop\""));
    }

    #[test]
    fn test_complex_template_literal() {
        let src = r#"const url = `api/${version}/${endpoint?.type || 'default'}/path`;"#;
        let result = downlevel_for_jsc(src).unwrap();
        assert!(!result.contains("?."));
        assert!(result.contains("`"));
    }

    #[test]
    fn test_return_optional_chain() {
        let src = "async function loadPlugin(name) { const pluginModule = await __hook_import(`./plugin/${name}.mjs`); return pluginModule?.default || pluginModule; }";
        let result = downlevel_for_jsc(src).unwrap();
        assert!(!result.contains("?."));
        assert!(result.contains("pluginModule != null"));
        assert!(!result.contains("return pluginModule != null ? return pluginModule.default"));
    }

    #[test]
    fn test_nested_optional_chain_with_constructor_name() {
        let src = "const x = React?.constructor?.name;";
        let result = downlevel_for_jsc(src).unwrap();
        assert!(!result.contains("?."));
        assert!(result.contains("React != null"));
        assert!(result.contains("React.constructor"));
        assert!(!result.contains("constructor :(undefined)"));
        assert!(!result.contains("Unexpected token"));
    }

    #[test]
    fn test_typeof_nested_optional_chain() {
        let src = "console.log('[get-client] React:', typeof React?.constructor?.name);";
        let result = downlevel_for_jsc(src).unwrap();
        println!("{}", result);
        assert!(!result.contains("?."));
        assert!(
            result.contains("typeof (React") || result.contains("typeof ((React")
        );
        assert!(result.contains("React.constructor"));
        assert!(!result.contains(",("));
        assert!(!result.contains("constructor :(undefined)"));
    }

    #[test]
    fn test_await_optional_chain_keyword_boundary() {
        let src = "async function read(obj) { return await obj?.read(); }";
        let result = downlevel_for_jsc(src).unwrap();
        assert!(!result.contains("?."));
        assert!(result.contains("return await (obj != null ? obj.read : undefined)();"));
    }
}
