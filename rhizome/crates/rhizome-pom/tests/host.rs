//! The host a transport drives, without the transport: commands only, drags, gestures,
//! files, the events each call causes, and the change hook. A made-up object model, *Loom*.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use rhizome_core::{IdSource, NodeType, Origin, Tree};
use rhizome_pom::*;
use serde_json::json;

struct Loom;

impl ObjectModel for Loom {
    const NAME: &'static str = "Loom";
    const EXTENSION: &'static str = "loom";
    /// How many threads there are, rebuilt on every change.
    type Projection = usize;

    type Context = ();

    fn kinds(k: &mut Kinds, _: &()) {
        k.category("threads", Origin::Loaded);
        k.kind(
            NodeType::new("thread")
                .in_categories(&["threads"])
                .float("thread.tension", 0.0..=1.0, 0.5)
                .text("thread.colour", "white")
                .described("Colour", "What the thread is dyed."),
        );
    }

    fn project(tree: &Tree, into: &mut usize, _: Option<&rhizome_core::Changeset>) {
        *into = tree
            .nodes()
            .iter()
            .filter(|n| n.type_name() == "thread")
            .count();
    }

    fn mirrored(threads: &usize) -> Option<serde_json::Value> {
        Some(json!({ "threads": threads }))
    }
}

const AT: &str = "/threads/warp";

/// A host on a shared in-memory store, with one thread, and a count of change-hook calls.
fn loom() -> (Arc<dyn Host>, Arc<Pom<Loom>>, MemoryStore, Arc<AtomicUsize>) {
    let store = MemoryStore::default();
    let s = store.clone();
    let calls = Arc::new(AtomicUsize::new(0));
    let c = calls.clone();
    let pom = Arc::new(
        Pom::<Loom>::new(move || Box::new(s.clone()), IdSource::sequential)
            .unwrap()
            .on_change(move |_| {
                c.fetch_add(1, Ordering::SeqCst);
            }),
    );
    let h = host(pom.clone());
    h.run(
        "node.add",
        &json!({"parent": "/threads", "type": "thread", "name": "warp"}),
        None,
    )
    .unwrap();
    (h, pom, store, calls)
}

fn set(v: serde_json::Value) -> serde_json::Value {
    json!({"at": AT, "key": "thread.tension", "value": v})
}

fn tension(pom: &Pom<Loom>) -> Option<f64> {
    pom.read(|d| {
        d.tree()
            .at(AT)
            .unwrap()
            .get(rhizome_core::Key::<f64>::new("thread.tension"))
    })
}

fn commits(events: &[Event]) -> usize {
    events
        .iter()
        .filter(|e| matches!(e, Event::Commit(_)))
        .count()
}

fn last_status(events: &[Event]) -> Option<&Status> {
    events.iter().rev().find_map(|e| match e {
        Event::Status(s) => Some(s),
        _ => None,
    })
}

#[test]
fn a_command_commits_and_reports() {
    let (h, pom, _, calls) = loom();
    let before = calls.load(Ordering::SeqCst);
    let (ran, events) = h.run("value.set", &set(json!(0.8)), None).unwrap();
    let Ran::Committed(c) = &ran else {
        panic!("{ran:?}")
    };
    assert_eq!(c.label, "Set thread.tension");
    assert_eq!(commits(&events), 1);
    let s = last_status(&events).expect("unsaved and undo changed");
    assert_eq!(s.undo.as_deref(), Some("Set thread.tension"));
    assert!(s.unsaved);
    assert_eq!(tension(&pom), Some(0.8));
    assert_eq!(
        calls.load(Ordering::SeqCst),
        before + 1,
        "the hook ran once"
    );
    assert_eq!(pom.read(|d| *d.projection()), 1);

    // the same again: a commit, but the status didn't change, so it isn't sent
    let (_, events) = h.run("value.set", &set(json!(0.7)), None).unwrap();
    assert_eq!(events.len(), 1, "{events:?}");

    // value.set goes through the schema: a key the kind lacks, out of range, the wrong kind
    assert!(
        !h.commands(&json!({"at": AT, "key": "nope", "value": 1}))
            .iter()
            .find(|c| c.id == "value.set")
            .unwrap()
            .enabled
    );
    assert!(h.run("value.set", &set(json!(2.0)), None).is_err());
    assert!(h.run("value.set", &set(json!("tight")), None).is_err());
    assert_eq!(tension(&pom), Some(0.7), "refusals change nothing");
}

#[test]
fn a_drag_is_one_undo_step() {
    let (h, pom, _, _) = loom();
    let steps = pom.read(|d| d.tree().history_len());
    for v in [0.6, 0.7, 0.9] {
        let (ran, _) = h
            .run("value.set", &set(json!(v)), Some("drag:tension"))
            .unwrap();
        assert!(matches!(ran, Ran::Committed(_)), "each run still commits");
    }
    assert_eq!(pom.read(|d| d.tree().history_len()), steps + 1);
    h.run("edit.undo", &json!({}), None).unwrap();
    assert_eq!(tension(&pom), Some(0.5));
}

#[test]
fn a_gesture_groups_commands() {
    let (h, pom, _, _) = loom();
    let steps = pom.read(|d| d.tree().history_len());
    let (token, events) = h.begin("Comb").unwrap();
    let s = last_status(&events).unwrap();
    assert!(s.gesture && s.undo.is_none(), "no undo mid-gesture: {s:?}");
    h.run("value.set", &set(json!(0.9)), None).unwrap();
    h.run(
        "value.set",
        &json!({"at": AT, "key": "thread.colour", "value": "red"}),
        None,
    )
    .unwrap();
    assert!(h.end(token + 1).is_err(), "only its own token ends it");
    let events = h.end(token).unwrap();
    assert!(!last_status(&events).unwrap().gesture);
    assert_eq!(pom.read(|d| d.tree().history_len()), steps + 1);

    // cancel takes it all back, as a commit
    let (token, _) = h.begin("Comb").unwrap();
    h.run("value.set", &set(json!(0.1)), None).unwrap();
    let events = h.cancel(token).unwrap();
    assert_eq!(commits(&events), 1);
    assert_eq!(tension(&pom), Some(0.9));

    // a gesture the front end lost is ended, keeping its edits: by a new one, or a reset
    let (stale, _) = h.begin("Comb").unwrap();
    h.run("value.set", &set(json!(0.2)), None).unwrap();
    let (fresh, _) = h.begin("Comb").unwrap();
    assert!(h.end(stale).is_err());
    h.end(fresh).unwrap();
    assert_eq!(tension(&pom), Some(0.2));
    h.begin("Comb").unwrap();
    let events = h.reset();
    assert!(
        !last_status(&events).unwrap().gesture,
        "reset always sends the status"
    );
    assert!(h.status().undo.is_some());
}

#[test]
fn files_replace_the_tree() {
    let (h, pom, store, calls) = loom();
    let events = h.save_as("/one".as_ref()).unwrap();
    let s = last_status(&events).unwrap();
    assert_eq!(s.path.as_deref(), Some("/one.loom"));
    assert_eq!((s.title.as_str(), s.unsaved), ("one.loom", false));
    assert!(store.get("/one.loom").is_some());

    // revert, new and open replace the whole tree: the generation moves, the hook runs
    h.run("value.set", &set(json!(0.9)), None).unwrap();
    let g = h.status().generation;
    let before = calls.load(Ordering::SeqCst);
    let (_, events) = h.run("file.revert", &json!({}), None).unwrap();
    assert_eq!(last_status(&events).unwrap().generation, g + 1);
    assert_eq!(calls.load(Ordering::SeqCst), before + 1);
    assert_eq!(tension(&pom), Some(0.5));

    h.begin("Comb").unwrap();
    let events = h.new_document().unwrap();
    let s = last_status(&events).unwrap();
    assert_eq!(
        (s.title.as_str(), s.gesture, s.generation),
        ("Untitled", false, g + 2)
    );
    assert_eq!(
        pom.read(|d| *d.projection()),
        0,
        "projected after the replace"
    );

    let (issues, events) = h.open("/one.loom".as_ref()).unwrap();
    assert!(issues.is_empty());
    assert_eq!(last_status(&events).unwrap().generation, g + 3);
    assert_eq!(tension(&pom), Some(0.5));
    assert!(h.tree().contains("\"warp\"") || h.tree().contains("/threads/warp"));

    // a file that isn't there leaves the document alone
    assert!(h.open("/nope.loom".as_ref()).is_err());
    assert_eq!(h.status().path.as_deref(), Some("/one.loom"));
    assert_eq!(h.extension(), "loom");
}

#[test]
fn the_wire_shapes() {
    let (h, _, _, _) = loom();
    assert_eq!(
        serde_json::to_value(h.status()).unwrap(),
        json!({
            "title": "Untitled — Edited",
            "path": null,
            "unsaved": true,
            "undo": "New thread",
            "redo": null,
            "gesture": false,
            "generation": 0
        })
    );
    let (ran, _) = h.run("value.set", &set(json!(0.8)), None).unwrap();
    let j = serde_json::to_value(&ran).unwrap();
    assert_eq!(j["committed"]["label"], "Set thread.tension");
    assert_eq!(j["committed"]["changes"][0]["change"], "value");
    assert_eq!(
        serde_json::to_value(Ran::Nothing).unwrap(),
        json!("nothing")
    );
    assert_eq!(
        serde_json::to_value(Ran::Text("x".into())).unwrap(),
        json!({"text": "x"})
    );
    let c = &h.commands(&json!({}))[0];
    assert_eq!(
        serde_json::to_value(c).unwrap(),
        json!({"id": "file.save", "label": "Save", "enabled": true})
    );
}

#[test]
fn a_host_goes_to_another_thread() {
    fn send_sync<T: Send + Sync + ?Sized>() {}
    send_sync::<dyn Host>();
    send_sync::<Pom<Loom>>();
}

/// A mirror as the webview keeps one: a view, then updates (decision 48).
struct Mirror {
    seq: u64,
    generation: u64,
    rows: std::collections::BTreeMap<rhizome_core::NodeId, rhizome_core::Row>,
    projection: Option<serde_json::Value>,
}

impl Mirror {
    fn of(h: &dyn Host) -> Mirror {
        let v = h.view();
        Mirror {
            seq: v.seq,
            generation: v.generation,
            rows: v.rows.into_iter().map(|r| (r.id, r)).collect(),
            projection: v.projection,
        }
    }

    /// Takes a call's events as a webview would: re-reads when the tree was replaced.
    fn take(&mut self, h: &dyn Host, events: &[Event]) {
        for e in events {
            match e {
                Event::Commit(u) if u.generation == self.generation && u.seq > self.seq => {
                    assert_eq!(u.seq, self.seq + 1, "no gaps");
                    self.seq = u.seq;
                    for id in &u.removed {
                        self.rows.remove(id);
                    }
                    for r in &u.rows {
                        self.rows.insert(r.id, r.clone());
                    }
                    if u.projection.is_some() {
                        self.projection = u.projection.clone();
                    }
                }
                Event::Status(s) if s.generation != self.generation => *self = Mirror::of(h),
                _ => {}
            }
        }
    }

    fn matches(&self, h: &dyn Host) {
        let fresh = Mirror::of(h);
        assert_eq!(self.rows, fresh.rows);
        assert_eq!(self.seq, fresh.seq);
        assert_eq!(self.projection, fresh.projection);
    }
}

#[test]
fn a_mirror_kept_by_updates_matches_the_view() {
    let (h, _, _, _) = loom();
    let mut m = Mirror::of(&*h);
    let step = |m: &mut Mirror, events: Vec<Event>| {
        m.take(&*h, &events);
        m.matches(&*h);
    };
    let run = |id: &str, p: serde_json::Value, key: Option<&str>| h.run(id, &p, key).unwrap().1;
    step(
        &mut m,
        run(
            "node.add",
            json!({"parent": "/threads", "type": "thread", "name": "weft"}),
            None,
        ),
    );
    for v in [0.6, 0.7] {
        step(&mut m, run("value.set", set(json!(v)), Some("drag")));
    }
    step(&mut m, run("edit.duplicate", json!({"at": AT}), None));
    step(&mut m, run("edit.undo", json!({}), None));
    let (token, events) = h.begin("Comb").unwrap();
    step(&mut m, events);
    step(&mut m, run("value.set", set(json!(0.1)), None));
    step(&mut m, h.cancel(token).unwrap());
    step(&mut m, h.save_as("/m".as_ref()).unwrap());
    step(&mut m, run("value.set", set(json!(0.3)), None));
    step(&mut m, run("file.revert", json!({}), None));
    step(&mut m, h.new_document().unwrap());

    // the view: rows with resolved values, and the schema
    let v = h.view();
    assert!(v.rows.iter().any(|r| r.path.to_string() == "/threads"));
    let thread = v.schema.types.iter().find(|t| t.name == "thread").unwrap();
    assert_eq!(thread.values[0].key, "thread.tension");
}

#[test]
fn several_values_in_one_step() {
    let (h, pom, _, _) = loom();
    h.run(
        "node.add",
        &json!({"parent": "/threads", "type": "thread", "name": "weft"}),
        None,
    )
    .unwrap();
    let steps = pom.read(|d| d.tree().history_len());
    let both = json!({"changes": [
        {"at": AT, "key": "thread.tension", "value": 0.9},
        {"at": "/threads/weft", "key": "thread.tension", "value": 0.2},
    ]});
    let (ran, events) = h.run("values.set", &both, None).unwrap();
    let Ran::Committed(c) = ran else { panic!() };
    assert_eq!(c.label, "Set thread.tension", "one key, named");
    assert_eq!(
        pom.read(|d| d.tree().history_len()),
        steps + 1,
        "one undo step"
    );
    let Event::Commit(u) = &events[0] else {
        panic!()
    };
    assert_eq!(u.rows.len(), 2, "both rows in one update");

    // all or nothing: one bad value refuses the batch
    let bad = json!({"changes": [
        {"at": AT, "key": "thread.tension", "value": 0.1},
        {"at": "/threads/weft", "key": "thread.tension", "value": 5.0},
    ]});
    assert!(h.run("values.set", &bad, None).is_err());
    assert_eq!(tension(&pom), Some(0.9));
    let mixed = json!({"changes": [
        {"at": AT, "key": "thread.tension", "value": 0.4},
        {"at": AT, "key": "thread.colour", "value": "red"},
    ]});
    let (ran, _) = h.run("values.set", &mixed, None).unwrap();
    let Ran::Committed(c) = ran else { panic!() };
    assert_eq!(c.label, "Set Values");
    assert!(
        !h.commands(&json!({"changes": []}))
            .iter()
            .any(|c| c.id == "values.set" && c.enabled)
    );
}

#[test]
fn a_set_is_named_by_the_value_label_when_it_has_one() {
    let (h, pom, _, _) = loom();
    h.run(
        "value.set",
        &json!({"at": AT, "key": "thread.colour", "value": "red"}),
        None,
    )
    .unwrap();
    assert_eq!(pom.status().undo.as_deref(), Some("Set Colour"));
    h.run(
        "values.set",
        &json!({"changes": [{"at": AT, "key": "thread.colour", "value": "blue"}]}),
        None,
    )
    .unwrap();
    assert_eq!(pom.status().undo.as_deref(), Some("Set Colour"));
}

#[test]
fn the_status_hook_sees_a_gesture_begin_and_end() {
    let seen = Arc::new(std::sync::Mutex::new(Vec::<Option<String>>::new()));
    let s = seen.clone();
    let pom = Arc::new(
        Pom::<Loom>::new(|| Box::new(MemoryStore::default()), IdSource::sequential)
            .unwrap()
            .on_status(move |st| s.lock().unwrap().push(st.undo.clone())),
    );
    let h = host(pom.clone());
    h.run(
        "node.add",
        &json!({"parent": "/threads", "type": "thread", "name": "warp"}),
        None,
    )
    .unwrap();
    let (token, _) = h.begin("Pull").unwrap();
    h.run("value.set", &set(json!(0.9)), None).unwrap();
    seen.lock().unwrap().clear();
    h.end(token).unwrap();
    // the commit inside the gesture reported Undo greyed; the end brings it back, named
    assert_eq!(*seen.lock().unwrap(), [Some("Pull".to_string())]);
}

fn sent(events: &[Event]) -> Vec<Option<serde_json::Value>> {
    events
        .iter()
        .filter_map(|e| match e {
            Event::Commit(u) => Some(u.projection.clone()),
            _ => None,
        })
        .collect()
}

#[test]
fn the_projection_is_in_the_view_and_in_an_update_only_when_it_changed() {
    let (h, _, _, _) = loom();
    assert_eq!(h.view().projection, Some(json!({"threads": 1})));

    // a value edit leaves the thread count alone: nothing to send
    let (_, events) = h.run("value.set", &set(json!(0.8)), None).unwrap();
    assert_eq!(sent(&events), vec![None]);

    let add = json!({"parent": "/threads", "type": "thread", "name": "weft"});
    let (_, events) = h.run("node.add", &add, None).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 2}))]);

    // undo carries the value it went back to; redo the one it came forward to
    let (_, events) = h.run("edit.undo", &json!({}), None).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 1}))]);
    let (_, events) = h.run("edit.redo", &json!({}), None).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 2}))]);
}

#[test]
fn a_cancelled_gesture_sends_the_projection_it_went_back_to() {
    let (h, _, _, _) = loom();
    let (token, _) = h.begin("Comb").unwrap();
    let add = json!({"parent": "/threads", "type": "thread", "name": "weft"});
    let (_, events) = h.run("node.add", &add, None).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 2}))]);
    let events = h.cancel(token).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 1}))]);
}

#[test]
fn a_replaced_tree_is_read_from_the_view_and_the_next_update_compares_with_it() {
    let (h, _, _, _) = loom();
    let mut m = Mirror::of(&*h);
    let add = json!({"parent": "/threads", "type": "thread", "name": "weft"});
    let take = |m: &mut Mirror, events: Vec<Event>| {
        m.take(&*h, &events);
        m.matches(&*h);
        events
    };
    take(&mut m, h.run("node.add", &add, None).unwrap().1);
    // new: no update, the generation moves and the view carries the projection
    let events = take(&mut m, h.new_document().unwrap());
    assert!(sent(&events).is_empty());
    assert_eq!(m.projection, Some(json!({"threads": 0})));
    // the first commit after compares with the new document's, not the old one's
    let events = take(&mut m, h.run("node.add", &add, None).unwrap().1);
    assert_eq!(sent(&events), vec![Some(json!({"threads": 1}))]);
}

#[test]
fn a_reconnect_sends_the_projection_again_with_the_next_commit() {
    let (h, _, _, _) = loom();
    h.reset();
    let (_, events) = h.run("value.set", &set(json!(0.8)), None).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 1}))]);
}

#[test]
fn a_coalesced_run_sends_the_projection_as_any_commit_does() {
    let (h, _, _, _) = loom();
    // a drag's steps share a key; each one that changes the count sends it
    let add = |name: &str| json!({"parent": "/threads", "type": "thread", "name": name});
    let (_, events) = h.run("node.add", &add("weft"), Some("comb")).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 2}))]);
    let (_, events) = h.run("node.add", &add("selvedge"), Some("comb")).unwrap();
    assert_eq!(sent(&events), vec![Some(json!({"threads": 3}))]);
    let (_, events) = h.run("value.set", &set(json!(0.4)), Some("comb")).unwrap();
    assert_eq!(sent(&events), vec![None]);
}
