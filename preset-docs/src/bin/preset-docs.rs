//! `preset-docs <catalogue.json> <out-dir> [--check] [--app <name>] [--preferences]`
//!
//! Writes one markdown page per node in the catalogue into `out-dir`, plus a `README.md`
//! index; existing pages change only between their markers and in the front-matter keys
//! the generator owns (title, node, group, summary). With `--check` it writes nothing and
//! fails if a page is missing, stale (block or front matter) or orphaned, the index is
//! stale, or a node has no summary. Values without a description are warnings, never
//! failures. `--app` names the index's title. The catalogue is JSON: a `Catalogue`, such as a dumped rhizome
//! schema, or an object holding one under `schema`. With `--preferences` it is a
//! preset-preferences schema (or a snapshot holding one), documented one page per settings page.

use std::path::PathBuf;
use std::process::ExitCode;

const USAGE: &str =
    "usage: preset-docs <catalogue.json> <out-dir> [--check] [--app <name>] [--preferences]";

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(e) => {
            eprintln!("preset-docs: {e}");
            ExitCode::from(2)
        }
    }
}

fn run() -> Result<ExitCode, String> {
    let mut args = std::env::args().skip(1);
    let mut positional = Vec::new();
    let mut check = false;
    let mut preferences = false;
    let mut app = String::new();
    while let Some(a) = args.next() {
        match a.as_str() {
            "--check" => check = true,
            "--preferences" => preferences = true,
            "--app" => app = args.next().ok_or(USAGE)?,
            "-h" | "--help" => {
                println!("{USAGE}");
                return Ok(ExitCode::SUCCESS);
            }
            s if s.starts_with("--") => return Err(format!("unknown flag {s}\n{USAGE}")),
            _ => positional.push(a),
        }
    }
    let [path, dir] = &positional[..] else {
        return Err(USAGE.into());
    };
    let dir = PathBuf::from(dir);
    let json = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let catalogue = if preferences {
        preset_docs::preferences::read(&json)
    } else {
        preset_docs::read_catalogue(&json)
    }
    .map_err(|e| format!("{path}: {e}"))?;

    if !check {
        for file in preset_docs::write(&dir, &catalogue, &app).map_err(|e| e.to_string())? {
            println!("wrote {}", dir.join(file).display());
        }
    }
    let findings = preset_docs::check(&dir, &catalogue, &app).map_err(|e| e.to_string())?;
    let mut failed = false;
    for f in &findings {
        // without --check the pages were just written; what remains is for a person
        let fails = check && !f.is_warning();
        failed |= fails;
        let tag = if fails { "error" } else { "warning" };
        eprintln!("{tag}: {f}");
    }
    Ok(if failed {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    })
}
