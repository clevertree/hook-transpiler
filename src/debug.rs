use std::sync::{Arc, Mutex};
use std::fmt;

/// Debug verbosity levels
#[cfg_attr(feature = "wasm", derive(serde::Serialize, serde::Deserialize))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum DebugLevel {
    Off = 0,
    Error = 1,
    Warn = 2,
    Info = 3,
    Trace = 4,
    Verbose = 5,
}

impl Default for DebugLevel {
    fn default() -> Self {
        #[cfg(feature = "debug")]
        {
            DebugLevel::Trace
        }
        #[cfg(not(feature = "debug"))]
        {
            DebugLevel::Off
        }
    }
}

impl fmt::Display for DebugLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Off => write!(f, "off"),
            Self::Error => write!(f, "error"),
            Self::Warn => write!(f, "warn"),
            Self::Info => write!(f, "info"),
            Self::Trace => write!(f, "trace"),
            Self::Verbose => write!(f, "verbose"),
        }
    }
}

impl std::str::FromStr for DebugLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "off" | "0" => Ok(DebugLevel::Off),
            "error" | "1" => Ok(DebugLevel::Error),
            "warn" | "warning" | "2" => Ok(DebugLevel::Warn),
            "info" | "3" => Ok(DebugLevel::Info),
            "trace" | "4" => Ok(DebugLevel::Trace),
            "verbose" | "5" => Ok(DebugLevel::Verbose),
            _ => Err(format!("Invalid debug level: {}", s)),
        }
    }
}

/// A single debug log entry
#[cfg_attr(feature = "wasm", derive(serde::Serialize, serde::Deserialize))]
#[derive(Debug, Clone, PartialEq)]
pub struct DebugEntry {
    pub level: DebugLevel,
    pub message: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

/// Debug context for a transpilation session
pub struct DebugContext {
    level: DebugLevel,
    logs: Arc<Mutex<Vec<DebugEntry>>>,
}

impl DebugContext {
    pub fn new(level: DebugLevel) -> Self {
        Self {
            level,
            logs: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn set_level(&mut self, level: DebugLevel) {
        self.level = level;
    }

    pub fn log(&self, entry_level: DebugLevel, message: impl Into<String>) {
        self.log_at(entry_level, message, None, None);
    }

    pub fn log_at(&self, entry_level: DebugLevel, message: impl Into<String>, line: Option<usize>, column: Option<usize>) {
        if entry_level <= self.level {
            let entry = DebugEntry {
                level: entry_level,
                message: message.into(),
                line,
                column,
            };
            
            if let Ok(mut logs) = self.logs.lock() {
                logs.push(entry);
            }
        }
    }

    pub fn error(&self, msg: impl Into<String>) {
        self.log(DebugLevel::Error, msg);
    }

    pub fn warn(&self, msg: impl Into<String>) {
        self.log(DebugLevel::Warn, msg);
    }

    pub fn info(&self, msg: impl Into<String>) {
        self.log(DebugLevel::Info, msg);
    }

    pub fn trace(&self, msg: impl Into<String>) {
        self.log(DebugLevel::Trace, msg);
    }

    pub fn verbose(&self, msg: impl Into<String>) {
        self.log(DebugLevel::Verbose, msg);
    }

    pub fn get_logs(&self) -> Vec<DebugEntry> {
        self.logs.lock()
            .map(|logs| logs.clone())
            .unwrap_or_default()
    }

    pub fn clear_logs(&self) {
        if let Ok(mut logs) = self.logs.lock() {
            logs.clear();
        }
    }

    pub fn format_logs(&self) -> String {
        let logs = self.get_logs();
        logs.iter()
            .map(|entry| {
                let location = match (entry.line, entry.column) {
                    (Some(line), Some(col)) => format!(" [{}:{}]", line, col),
                    (Some(line), None) => format!(" [line {}]", line),
                    _ => String::new(),
                };
                format!("[{}]{}: {}", entry.level, location, entry.message)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

impl Default for DebugContext {
    fn default() -> Self {
        Self::new(DebugLevel::default())
    }
}

impl Clone for DebugContext {
    fn clone(&self) -> Self {
        Self {
            level: self.level,
            logs: self.logs.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debug_level_ordering() {
        assert!(DebugLevel::Off < DebugLevel::Error);
        assert!(DebugLevel::Error < DebugLevel::Warn);
        assert!(DebugLevel::Trace < DebugLevel::Verbose);
    }

    #[test]
    fn test_debug_level_from_str() {
        assert_eq!("trace".parse::<DebugLevel>().unwrap(), DebugLevel::Trace);
        assert_eq!("off".parse::<DebugLevel>().unwrap(), DebugLevel::Off);
        assert_eq!("5".parse::<DebugLevel>().unwrap(), DebugLevel::Verbose);
    }

    #[test]
    fn test_debug_context_filtering() {
        let ctx = DebugContext::new(DebugLevel::Warn);
        ctx.trace("should not be logged");
        ctx.warn("should be logged");
        ctx.error("should be logged");

        let logs = ctx.get_logs();
        assert_eq!(logs.len(), 2);
        assert_eq!(logs[0].level, DebugLevel::Warn);
        assert_eq!(logs[1].level, DebugLevel::Error);
    }

    #[test]
    fn test_debug_entry_with_position() {
        let ctx = DebugContext::new(DebugLevel::Trace);
        ctx.log_at(DebugLevel::Error, "syntax error", Some(42), Some(10));

        let logs = ctx.get_logs();
        assert_eq!(logs[0].line, Some(42));
        assert_eq!(logs[0].column, Some(10));
    }
}
