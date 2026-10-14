//! The generator over a made-up catalogue: the pages it writes (pinned in `tests/golden/`),
//! what it keeps when it rewrites one, and what `check` notices.

use std::fs;
use std::path::PathBuf;

use preset_docs::{Catalogue, Finding, INDEX, Page, check, pages, read_catalogue, update, write};

/// A made-up app: a widget with one control of every kind, a wobble with named steps and a
/// binding, and a bare node with no words at all.
const FIXTURE: &str = include_str!("fixtures/catalogue.json");

fn schema() -> Catalogue {
    read_catalogue(FIXTURE).unwrap()
}

fn page(name: &str) -> Page {
    pages(&schema(), "Example")
        .into_iter()
        .find(|p| p.file_name == name)
        .unwrap()
}

fn golden(name: &str, actual: &str) {
    let file = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/golden")
        .join(name);
    if std::env::var_os("PRESET_DOCS_BLESS").is_some() {
        fs::write(&file, actual).unwrap();
        return;
    }
    let expected = fs::read_to_string(&file)
        .unwrap_or_else(|_| panic!("no golden {name}; run `just bless` and read it"));
    assert_eq!(expected, actual, "{name} differs from its golden");
}

/// A fresh, empty folder of the test's own.
fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("preset-docs-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn a_page_and_the_index_as_generated() {
    golden("widget.md", &page("widget.md").content);
    golden("wobble.md", &page("wobble.md").content);
    golden("README.md", &page(INDEX).content);
}

#[test]
fn rewriting_keeps_every_byte_outside_the_block() {
    let fresh = page("widget.md");
    let written = fresh.content.replace(
        "## Using it\n",
        "## Using it\n\nHand-written, with a trailing space \nand CRLF\r\nand no final newline",
    );
    let written = written.replacen("node: widget\n", "node: widget\nauthor: someone\n", 1);
    // the block goes stale: someone edited the generated table by hand
    let stale = written.replacen("How fast it turns.", "Out of date.", 1);
    let rewritten = update(Some(&stale), &fresh);
    assert_eq!(rewritten, written);

    let begin = stale.find("<!-- generated:begin").unwrap();
    let end = stale.find("<!-- generated:end -->").unwrap();
    assert_eq!(rewritten[..begin], stale[..begin]);
    let tail = stale.len() - end;
    assert_eq!(rewritten[rewritten.len() - tail..], stale[end..]);
}

#[test]
fn a_custom_begin_marker_line_is_kept() {
    let fresh = page("wobble.md");
    let own = fresh.content.replacen(
        "<!-- generated:begin — preset-docs rewrites this block; write outside it -->",
        "<!-- generated:begin (just docs) -->",
        1,
    );
    assert_eq!(update(Some(&own), &fresh), own);
}

#[test]
fn generating_twice_changes_nothing() {
    for p in pages(&schema(), "Example") {
        let once = update(None, &p);
        let twice = update(Some(&once), &p);
        assert_eq!(once, twice, "{}", p.file_name);
    }
    let dir = scratch("twice");
    assert!(!write(&dir, &schema(), "Example").unwrap().is_empty());
    assert_eq!(
        write(&dir, &schema(), "Example").unwrap(),
        Vec::<String>::new()
    );
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn a_page_without_markers_gets_the_block_appended() {
    let fresh = page("wobble.md");
    let mine = "# Wobble\n\nWritten before the generator.\n";
    let merged = update(Some(mine), &fresh);
    // the generated front matter goes in front; the page follows unchanged
    assert!(merged.starts_with("---\ntitle: Wobble\n"));
    assert!(merged.contains(&format!("---\n\n{mine}")));
    assert!(merged.contains("| Rate | 0.01 Hz to 40 Hz | 1 Hz | How often it moves. |"));
    assert_eq!(update(Some(&merged), &fresh), merged);
}

#[test]
fn a_broken_block_is_left_alone_and_reported() {
    let dir = scratch("broken");
    write(&dir, &schema(), "Example").unwrap();
    let path = dir.join("wobble.md");
    let broken = fs::read_to_string(&path)
        .unwrap()
        .replace("<!-- generated:end -->", "");
    fs::write(&path, &broken).unwrap();
    assert_eq!(update(Some(&broken), &page("wobble.md")), broken);
    let found = check(&dir, &schema(), "Example").unwrap();
    assert!(found.contains(&Finding::NoBlock {
        file: "wobble.md".into()
    }));
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn check_finds_what_is_out_of_step() {
    let dir = scratch("check");
    let schema = schema();
    let failures = |dir: &PathBuf| -> Vec<Finding> {
        check(dir, &schema, "Example")
            .unwrap()
            .into_iter()
            .filter(|f| !f.is_warning())
            .collect()
    };

    // nothing written yet
    let found = failures(&dir);
    assert!(found.contains(&Finding::MissingPage {
        file: "widget.md".into()
    }));
    assert!(found.contains(&Finding::StaleIndex));
    assert!(found.contains(&Finding::MissingSummary {
        node: "bare".into()
    }));

    // written: only the missing summary is left, and the missing descriptions warn
    write(&dir, &schema, "Example").unwrap();
    assert_eq!(
        failures(&dir),
        vec![Finding::MissingSummary {
            node: "bare".into()
        }]
    );
    let all = check(&dir, &schema, "Example").unwrap();
    assert!(all.contains(&Finding::MissingDescription {
        node: "widget".into(),
        key: "widget.teeth".into()
    }));

    // a stale block, prose added by hand, and a page whose type is gone
    let path = dir.join("widget.md");
    let text = fs::read_to_string(&path).unwrap();
    let edited = text.replace("## Using it\n", "## Using it\n\nMine.\n");
    fs::write(
        &path,
        edited.replacen("How fast it turns.", "Old words.", 1),
    )
    .unwrap();
    fs::write(dir.join("gone.md"), "# Gone\n").unwrap();
    let found = failures(&dir);
    assert!(found.contains(&Finding::StaleBlock {
        file: "widget.md".into()
    }));
    assert!(found.contains(&Finding::Orphan {
        file: "gone.md".into()
    }));

    // regenerating fixes the block, keeps the prose, and leaves the orphan for a person
    write(&dir, &schema, "Example").unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), edited);
    assert!(dir.join("gone.md").exists());
    assert!(!failures(&dir).contains(&Finding::StaleBlock {
        file: "widget.md".into()
    }));
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn a_catalogue_or_a_view_holding_one_reads_back() {
    let json: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
    let view = serde_json::json!({ "seq": 0, "schema": json, "rows": [] }).to_string();
    assert_eq!(read_catalogue(&view).unwrap(), schema());
}

#[test]
fn the_front_matter_keeps_hand_keys_and_follows_the_catalogue() {
    let fresh = page("widget.md");
    // a hand-added key at the top and one after the summary, and a summary out of date
    let hand = fresh
        .content
        .replacen("---\n", "---\ndraft: true\n", 1)
        .replacen(
            "summary: \"A made-up part: round, and a little louder when it spins.\"\n",
            "summary: \"A made-up part: round, and a little louder when it spins.\"\ntags: [a, b]   # mine\n",
            1,
        );
    let stale = hand.replacen(
        "summary: \"A made-up part: round, and a little louder when it spins.\"\n",
        "summary: An old sentence,\n  carried on a second line.\n",
        1,
    );
    assert_ne!(stale, hand);
    assert_eq!(update(Some(&stale), &fresh), hand);
    assert_eq!(update(Some(&hand), &fresh), hand);

    // a generated key gone missing comes back after the one before it
    let no_group = hand.replacen("group: parts\n", "", 1);
    assert_eq!(update(Some(&no_group), &fresh), hand);

    // keys the catalogue no longer gives are removed; others stay
    let bare = page("bare.md");
    let extra = bare.content.replacen(
        "node: bare\n",
        "node: bare\ngroup: old\nowner: me\nsummary: old\n",
        1,
    );
    assert_eq!(
        update(Some(&extra), &bare),
        bare.content
            .replacen("node: bare\n", "node: bare\nowner: me\n", 1)
    );
}

#[test]
fn check_reports_front_matter_drift_until_rewritten() {
    let dir = scratch("front");
    let schema = schema();
    write(&dir, &schema, "Example").unwrap();
    let path = dir.join("wobble.md");
    let on_disk = fs::read_to_string(&path).unwrap();
    let drifted = on_disk
        .replacen(
            "summary: Moves another value back and forth.",
            "summary: Old words.",
            1,
        )
        .replacen("---\n", "---\nauthor: someone\n", 1);
    fs::write(&path, &drifted).unwrap();
    let drift = Finding::StaleFrontMatter {
        file: "wobble.md".into(),
    };
    let found = check(&dir, &schema, "Example").unwrap();
    assert!(found.contains(&drift));
    assert!(!drift.is_warning());
    assert!(!found.contains(&Finding::StaleBlock {
        file: "wobble.md".into()
    }));

    write(&dir, &schema, "Example").unwrap();
    let fixed = fs::read_to_string(&path).unwrap();
    assert_eq!(
        fixed,
        on_disk.replacen("---\n", "---\nauthor: someone\n", 1)
    );
    assert!(!check(&dir, &schema, "Example").unwrap().contains(&drift));
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn a_page_with_a_thumbnail_puts_its_group_in_a_table() {
    let dir = scratch("thumbnail");
    write(&dir, &schema(), "Example").unwrap();
    let plain = fs::read_to_string(dir.join(INDEX)).unwrap();
    // the fixture's bare node has no summary, so a fresh folder is never quite clean
    let before = check(&dir, &schema(), "Example").unwrap();
    let path = dir.join("widget.md");
    let named = fs::read_to_string(&path).unwrap().replacen(
        "node: widget\n",
        "node: widget\nthumbnail: \"img/widget.webp\"\n",
        1,
    );
    fs::write(&path, &named).unwrap();

    // the index is stale until it is written again, and the page keeps its key
    assert!(
        check(&dir, &schema(), "Example")
            .unwrap()
            .contains(&Finding::StaleIndex)
    );
    assert_eq!(write(&dir, &schema(), "Example").unwrap(), vec![INDEX]);
    assert_eq!(fs::read_to_string(&path).unwrap(), named);
    assert_eq!(check(&dir, &schema(), "Example").unwrap(), before);

    let index = fs::read_to_string(dir.join(INDEX)).unwrap();
    golden("README-thumbnails.md", &index);
    // groups with no thumbnail are listed as before
    assert_eq!(
        index.split("## Parts").next(),
        plain.split("## Parts").next()
    );
    fs::remove_dir_all(&dir).unwrap();
}

/// Ops of a made-up editor: two categories, one node with only a group, one with neither.
const CATEGORISED: &str = r#"{"types": [
  {"name": "film", "label": "Film", "group": "modifier", "category": "colour", "summary": "A look.",
   "values": [{"key": "stock", "kind": "choice", "default": "sx70",
     "choices": ["sx70", "polaroid_600", "plain"],
     "choice_labels": {"polaroid_600": "Instant"}}]},
  {"name": "blur", "group": "modifier", "category": "distortion"},
  {"name": "crop", "group": "geometry"},
  {"name": "loose"}
]}"#;

fn categorised(name: &str) -> Page {
    pages(&read_catalogue(CATEGORISED).unwrap(), "Example")
        .into_iter()
        .find(|p| p.file_name == name)
        .unwrap()
}

#[test]
fn the_index_groups_by_category_then_group_then_other() {
    let index = categorised(INDEX).content;
    let heading = |h: &str| index.find(h).unwrap_or_else(|| panic!("no {h}\n{index}"));
    // headings keep their order: sorted, with Other last
    assert!(heading("## Colour") < heading("## Distortion"));
    assert!(heading("## Distortion") < heading("## Geometry"));
    assert!(heading("## Geometry") < heading("## Other"));
    assert!(
        !index.contains("## Modifier"),
        "the lane is shadowed by the category"
    );
    let colour = &index[heading("## Colour")..heading("## Distortion")];
    assert!(colour.contains("[Film](film.md)"));
}

#[test]
fn a_thumbnail_still_shows_under_a_category() {
    let dir = scratch("category-thumbnail");
    let catalogue = read_catalogue(CATEGORISED).unwrap();
    write(&dir, &catalogue, "Example").unwrap();
    let path = dir.join("film.md");
    let named = fs::read_to_string(&path).unwrap().replacen(
        "node: film\n",
        "node: film\nthumbnail: \"img/film.webp\"\n",
        1,
    );
    fs::write(&path, named).unwrap();
    write(&dir, &catalogue, "Example").unwrap();
    let index = fs::read_to_string(dir.join(INDEX)).unwrap();
    let colour = index
        .split("## Colour")
        .nth(1)
        .unwrap()
        .split("## ")
        .next()
        .unwrap();
    assert!(colour.contains("| ![Film](img/film.webp) | [Film](film.md) | A look. |"));
    assert!(
        index
            .split("## Distortion")
            .nth(1)
            .unwrap()
            .starts_with("\n\n- [blur](blur.md)")
    );
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn a_page_names_its_category_only_when_it_has_one() {
    let film = categorised("film.md").content;
    assert!(film.contains("group: modifier\ncategory: colour\nsummary: A look.\n"));
    assert!(!categorised("crop.md").content.contains("category"));
    // rewriting an old page adds the key in place and keeps the rest
    let old = film.replace("category: colour\n", "");
    assert_eq!(update(Some(&old), &categorised("film.md")), film);
    // and a node that loses its category loses the key
    assert!(!update(Some(&film), &categorised("crop.md")).contains("category: colour"));
}

#[test]
fn a_labelled_choice_shows_its_label_and_key() {
    let film = categorised("film.md").content;
    assert!(
        film.contains("sx70, Instant (`polaroid_600`), plain"),
        "{film}"
    );
    // the default is shown the same way when labelled, and as it is when not
    assert!(film.contains("| sx70 |"), "{film}");
    let other = CATEGORISED.replace("\"default\": \"sx70\"", "\"default\": \"polaroid_600\"");
    let page = pages(&read_catalogue(&other).unwrap(), "Example")
        .into_iter()
        .find(|p| p.file_name == "film.md")
        .unwrap();
    assert!(page.content.contains("| Instant (`polaroid_600`) |"));
}

#[test]
fn no_category_or_labels_means_the_pages_as_before() {
    // the goldens above are the fixture's pages from before the fields existed; an explicit
    // empty form of the new fields reads to the very same pages
    let explicit = FIXTURE.replace(
        "\"kind\": \"choice\"",
        "\"kind\": \"choice\", \"choice_labels\": {}",
    );
    assert_ne!(explicit, FIXTURE);
    let a = pages(&schema(), "Example");
    let b = pages(&read_catalogue(&explicit).unwrap(), "Example");
    assert_eq!(a, b);
    assert!(a.iter().all(|p| !p.content.contains("category:")));
}
