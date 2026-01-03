use std::rc::Rc;
use std::panic::catch_unwind;
use std::panic::AssertUnwindSafe;

use anyhow::{Context, Result};
use base64::engine::general_purpose::STANDARD as Base64;
use base64::Engine;
use swc_core::common::{comments::{Comments, NoopComments}, sync::Lrc, FileName, Globals, Mark, SourceMap, GLOBALS};
use swc_core::ecma::transforms::base::{feature::FeatureFlag, helpers::HELPERS};
use swc_core::ecma::ast::{EsVersion, Program};
use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter, Config as CodegenConfig};
use swc_core::ecma::parser::{EsConfig, Syntax, TsConfig, lexer::Lexer, Parser, StringInput};
use swc_core::ecma::transforms::base::{fixer::fixer, resolver};
use swc_core::ecma::transforms::compat::es2015::{es2015, Config as Es2015Config, block_scoping};
use swc_core::ecma::transforms::compat::es2020::{es2020, Config as Es2020Config};
use swc_core::ecma::transforms::module::common_js::{common_js, Config as CjsConfig};
use swc_core::ecma::transforms::react::{self, Runtime};
use swc_core::ecma::transforms::typescript::strip;
use swc_core::ecma::visit::FoldWith;

use crate::TranspileOptions;

/// SWC-based transpilation pipeline for native targets (Android/iOS/desktop).
/// - Parses JSX/TSX with SWC
/// - Runs the React transform (automatic runtime)
/// - Strips TypeScript when requested
/// - Applies hygiene/fixer and emits ES2020+ JS (module format handled by caller)
pub fn transpile_with_swc(source: &str, opts: &TranspileOptions) -> Result<String> {
    // Wrap in catch_unwind to prevent panics from crashing JNI
    match catch_unwind(AssertUnwindSafe(|| transpile_with_swc_inner(source, opts))) {
        Ok(result) => result,
        Err(panic_info) => {
            let panic_msg = if let Some(s) = panic_info.downcast_ref::<String>() {
                s.clone()
            } else if let Some(s) = panic_info.downcast_ref::<&str>() {
                s.to_string()
            } else {
                "Unknown panic in SWC transpiler".to_string()
            };
            Err(anyhow::anyhow!("SWC panic: {}", panic_msg))
        }
    }
}

fn transpile_with_swc_inner(source: &str, opts: &TranspileOptions) -> Result<String> {
    let filename = opts
        .filename
        .as_deref()
        .unwrap_or("hook.jsx")
        .to_string();

    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(FileName::Real(filename.into()).into(), source.into());

    let syntax = if opts.is_typescript {
        Syntax::Typescript(TsConfig {
            tsx: true,
            ..Default::default()
        })
    } else {
        Syntax::Es(EsConfig {
            jsx: true,
            ..Default::default()
        })
    };

    let lexer = Lexer::new(syntax, EsVersion::Es2020, StringInput::from(&*fm), None);
    let mut parser = Parser::new_from(lexer);

    let module = parser
        .parse_module()
        .map_err(|e| anyhow::anyhow!(e.kind().msg().to_string()))
        .context("failed to parse module with SWC")?;

    GLOBALS.set(&Globals::new(), || {
        HELPERS.set(&Default::default(), || {
            let unresolved = Mark::new();
            let top_level = Mark::fresh(Mark::root());
            let comments: Option<Rc<NoopComments>> = None;

            // resolver → TS strip (before React) → react JSX transform → fixer
            let mut module = module
                .fold_with(&mut resolver(unresolved, top_level, false));

            // Strip TypeScript BEFORE React transform so JSX isn't interfered with
            if opts.is_typescript {
                // TypeScript strip needs to work at Program level
                let mut program = Program::Module(module);
                program = program.fold_with(&mut strip(unresolved, top_level));
                module = match program {
                    Program::Module(m) => m,
                    _ => unreachable!("Program should still be Module after strip"),
                };
            }

            // Now run React transform on clean JavaScript
            module = module
                .fold_with(&mut react::react(
                cm.clone(),
                comments.clone(),
                react::Options {
                    runtime: Some(Runtime::Automatic),
                    development: Some(false),
                    import_source: Some("__hook_jsx_runtime".into()),
                    ..Default::default()
                },
                top_level,
                unresolved,
            ));

            if opts.to_commonjs {
            module = module.fold_with(&mut common_js(
                unresolved,
                CjsConfig {
                    allow_top_level_this: true,
                    ..Default::default()
                },
                FeatureFlag::all(),
                comments.clone(),
            ));
        }

        if opts.compat_for_jsc {
            // ES2020 downlevel (optional chaining, nullish coalescing, etc.)
            module = module.fold_with(&mut es2020(
                Es2020Config {
                    optional_chaining: Default::default(),
                    nullish_coalescing: Default::default(),
                },
                unresolved,
            ));
            // ES2015 downlevel for older JSC
            module = module.fold_with(&mut es2015(
                unresolved,
                comments.clone(),
                Es2015Config { ..Default::default() },
            ));
            // Explicit block scoping to convert const/let to var
            module = module.fold_with(&mut block_scoping(unresolved));
        }

        module = module.fold_with(&mut fixer(comments.as_deref().map(|c| c as &dyn Comments)));

        let mut buf = Vec::new();
        let mut sm_buf = Vec::new();
        {
            let mut emitter = Emitter {
                cfg: CodegenConfig::default(),
                cm: cm.clone(),
                comments: None,
                wr: JsWriter::new(cm.clone(), "\n", &mut buf, if opts.source_maps { Some(&mut sm_buf) } else { None }),
            };
            emitter.emit_module(&module)?;
        }

        let mut code = String::from_utf8(buf).context("failed to encode SWC output as UTF-8")?;

        if opts.source_maps {
            if !sm_buf.is_empty() {
                let sm = cm.build_source_map(&sm_buf);
                let mut sm_json = Vec::new();
                sm.to_writer(&mut sm_json)
                    .context("failed to serialize source map")?;
                let encoded = Base64.encode(sm_json);
                if opts.inline_source_map {
                    code.push_str("\n//# sourceMappingURL=data:application/json;base64,");
                    code.push_str(&encoded);
                }
            }
        }

        Ok(code)
        })
    })
}
