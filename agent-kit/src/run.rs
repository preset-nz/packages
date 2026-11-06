//! The tool loop: ask, run what the model calls, hand back the results, ask
//! again, until it stops calling or a limit stops it. A reasoning model calls
//! one tool a turn and waits for its result, so the loop is the norm, not a
//! fallback.
//!
//! Every limit is reported, never silent: a token
//! cap per turn, a wall-clock budget per reply checked while streaming, a turn
//! cap, and a cancel flag.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{json, Value as Json};

use crate::client::{self, Delta, Failure, Load, Model, Sampling};
use crate::tools::{self, Toolbox};

/// What one reply may spend.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    pub max_tokens: u32,
    pub budget: Duration,
    pub turns: usize,
}

impl Limits {
    /// Reasoning off: a reply in seconds.
    pub fn quick() -> Self {
        Self {
            max_tokens: 8000,
            budget: Duration::from_secs(60),
            turns: 10,
        }
    }

    /// Reasoning on: a few minutes of thinking per reply.
    pub fn considered() -> Self {
        Self {
            budget: Duration::from_secs(240),
            ..Self::quick()
        }
    }
}

/// Which limit stopped a reply.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Reason {
    Cancelled,
    Time,
    Tokens,
    Turns,
    /// Its own text went round in circles (and, in Quick, again).
    Looping,
}

/// What a reply is doing right now, as far as the person watching can tell.
/// The loop reports it so no app has to work it out from the deltas.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    /// The server is loading the model before it can answer.
    Loading,
    /// A request is sent and nothing has come back. After idle, LM Studio
    /// stalls here while it wakes the model.
    Waiting,
    /// The model is reasoning.
    Thinking,
    /// Text or a tool call is arriving.
    Answering,
}

/// What the app's UI hears, as the caller forwards it (Tauri apps use `agent://event`). Every reply starts with
/// `start` and ends with exactly one `done`; `stopped` or `error` come just
/// before it when the reply didn't finish on its own.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Event {
    Start {
        prompt: String,
        /// The model asked, or empty when none could be.
        model: String,
        /// Reasoning on (Considered), not Quick.
        considered: bool,
    },
    Text {
        delta: String,
    },
    Reasoning {
        delta: String,
    },
    Tool {
        name: String,
        args: Json,
        result: String,
        ok: bool,
    },
    Stopped {
        reason: Reason,
    },
    /// A muted line about what the loop did on its own.
    Note {
        text: String,
    },
    Error {
        message: String,
    },
    /// The reply changed phase. `model` and `seconds` are filled only for
    /// `loading`: which model, and about how long the server says it takes.
    Phase {
        phase: Phase,
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        seconds: Option<f32>,
    },
    /// Whether the reply's writes reached the document, as one undo step
    /// named `label`.
    Done {
        applied: bool,
        label: String,
    },
}

/// How a reply ended.
#[derive(Debug, Clone, PartialEq)]
pub enum End {
    /// The model stopped calling tools.
    Finished,
    Stopped(Reason),
    Failed(String),
}

/// One request: the system prompt and the first user message, both the
/// app's.
pub struct Ask<'a> {
    pub model: &'a str,
    pub system: &'a str,
    pub user: String,
    pub quick: bool,
    pub limits: Limits,
    pub sampling: Sampling,
    /// The load the server has to finish before `model` answers, from
    /// `Model::resolve`. The reply opens with it and its budget grows to fit.
    pub load: Option<Load>,
}

/// What a load adds to a reply's wall-clock budget: twice the server's
/// estimate and 10 s, since an estimate from other models' loads can be
/// short; 60 s when it has none. A quick reply keeps its own time to think
/// however long the model takes to load.
fn load_allowance(load: &Load) -> Duration {
    match load.seconds {
        Some(s) if s.is_finite() && s >= 0.0 => Duration::from_secs_f32(2.0 * s + 10.0),
        _ => Duration::from_secs(60),
    }
}

/// Moves to `next`, telling `emit` only when it is a change.
fn enter(now: &mut Option<Phase>, next: Phase, emit: &mut dyn FnMut(Event)) {
    if *now != Some(next) {
        *now = Some(next);
        emit(Event::Phase {
            phase: next,
            model: None,
            seconds: None,
        });
    }
}

/// Said when a considered turn is asked again without thinking.
pub const RETRY_NOTE: &str = "Thinking went in circles; asked again without thinking.";

/// Runs one reply against `toolbox`, telling `emit` as it goes. Emits
/// neither `start` nor `done`: those are the caller's, who applies the
/// writes.
pub fn reply(
    model: &mut dyn Model,
    toolbox: &mut dyn Toolbox,
    ask: &Ask<'_>,
    cancel: &AtomicBool,
    emit: &mut dyn FnMut(Event),
) -> End {
    let started = Instant::now();
    let deadline =
        started + ask.limits.budget + ask.load.as_ref().map_or(Duration::ZERO, load_allowance);
    let mut phase: Option<Phase> = None;
    if let Some(load) = &ask.load {
        phase = Some(Phase::Loading);
        emit(Event::Phase {
            phase: Phase::Loading,
            model: Some(ask.model.to_string()),
            seconds: load.seconds,
        });
    }
    // Built once, so every request carries the same bytes before the
    // conversation: the server's prompt cache keeps them.
    let tools = toolbox.tools().openai();
    let mut messages = vec![
        json!({ "role": "system", "content": ask.system }),
        json!({ "role": "user", "content": ask.user }),
    ];
    let mut calls_so_far = 0usize;
    // A considered reply that loops is asked again with reasoning off, once;
    // the rest of the reply stays off, so the request body stays the same
    // from turn to turn.
    let mut quick = ask.quick;
    let mut turns_left = ask.limits.turns;
    while turns_left > 0 {
        turns_left -= 1;
        if cancel.load(Ordering::Acquire) {
            return End::Stopped(Reason::Cancelled);
        }
        let body = client::body(
            ask.model,
            &messages,
            &tools,
            quick,
            ask.limits.max_tokens,
            ask.sampling.for_mode(quick),
        );
        // The first request is the one the server loads the model for, so a
        // load stays on screen until the model speaks; `waiting` would hide it.
        if phase != Some(Phase::Loading) {
            enter(&mut phase, Phase::Waiting, emit);
        }
        let mut thinking = String::new();
        // Per turn: its first reasoning delta is `thinking`, its first text
        // or tool call is `answering`.
        let (mut thought, mut answered) = (false, false);
        let mut on = |d: Delta| match d {
            Delta::Text(delta) => {
                if !std::mem::replace(&mut answered, true) {
                    enter(&mut phase, Phase::Answering, emit);
                }
                emit(Event::Text { delta })
            }
            Delta::Reasoning(delta) => {
                if !std::mem::replace(&mut thought, true) {
                    enter(&mut phase, Phase::Thinking, emit);
                }
                thinking.push_str(&delta);
                emit(Event::Reasoning { delta })
            }
            Delta::Calling => {
                if !std::mem::replace(&mut answered, true) {
                    enter(&mut phase, Phase::Answering, emit);
                }
            }
        };
        let turn = match model.turn(&body, deadline, cancel, &mut on) {
            Ok(t) => t,
            Err(Failure::Cancelled) => return End::Stopped(Reason::Cancelled),
            Err(Failure::Time) => return End::Stopped(Reason::Time),
            Err(Failure::Http(m)) => return End::Failed(m),
            Err(Failure::Looping) if quick => return End::Stopped(Reason::Looping),
            Err(Failure::Looping) => {
                quick = true;
                turns_left += 1;
                emit(Event::Note {
                    text: RETRY_NOTE.into(),
                });
                carry_plan(&mut messages, &thinking);
                continue;
            }
        };
        let cut = turn.finish.as_deref() == Some("length");
        if turn.calls.is_empty() {
            // Cut off with no words and no calls: still thinking.
            if cut && !quick && turn.text.trim().is_empty() {
                quick = true;
                turns_left += 1;
                emit(Event::Note {
                    text: RETRY_NOTE.into(),
                });
                carry_plan(&mut messages, &thinking);
                continue;
            }
            return if cut {
                End::Stopped(Reason::Tokens)
            } else {
                End::Finished
            };
        }
        let ids: Vec<String> = turn
            .calls
            .iter()
            .enumerate()
            .map(|(i, c)| {
                if c.id.is_empty() {
                    format!("call_{}", calls_so_far + i)
                } else {
                    c.id.clone()
                }
            })
            .collect();
        calls_so_far += turn.calls.len();
        messages.push(json!({
            "role": "assistant",
            "content": if turn.text.is_empty() { Json::Null } else { json!(turn.text) },
            "tool_calls": turn.calls.iter().zip(&ids).map(|(c, id)| json!({
                "id": id,
                "type": "function",
                "function": { "name": c.name, "arguments": c.arguments },
            })).collect::<Vec<_>>(),
        }));
        for (c, id) in turn.calls.iter().zip(&ids) {
            if cancel.load(Ordering::Acquire) {
                return End::Stopped(Reason::Cancelled);
            }
            let (args, outcome) = match toolbox.tools().get(&c.name).cloned() {
                None => (
                    Json::Null,
                    Err(format!(
                        "there is no tool called {}; the tools are {}",
                        c.name,
                        toolbox
                            .tools()
                            .iter()
                            .map(|t| t.name)
                            .collect::<Vec<_>>()
                            .join(", ")
                    )),
                ),
                Some(tool) => match tools::arguments(&tool, &c.arguments) {
                    Ok(args) => {
                        let out = toolbox.call(&tool, &args);
                        (args, out)
                    }
                    Err(e) => (json!(c.arguments), Err(e)),
                },
            };
            let ok = outcome.is_ok();
            let result = match outcome {
                Ok(r) => r,
                Err(e) => format!("refused: {e}"),
            };
            emit(Event::Tool {
                name: c.name.clone(),
                args,
                result: result.clone(),
                ok,
            });
            messages.push(json!({ "role": "tool", "tool_call_id": id, "content": result }));
        }
        if cut {
            return End::Stopped(Reason::Tokens);
        }
    }
    End::Stopped(Reason::Turns)
}

/// How much of a cut-off thinking the retry is handed back.
const PLAN_TAIL: usize = 3000;

/// Tells the retried turn what it had worked out: the tail of its thinking,
/// from the start of a line so a sentence isn't cut mid-word. Only messages
/// grow; the system prompt and the tools stay the same bytes.
fn carry_plan(messages: &mut Vec<Json>, thinking: &str) {
    let t = thinking.trim();
    if t.is_empty() {
        return;
    }
    let mut start = t.len().saturating_sub(PLAN_TAIL);
    while !t.is_char_boundary(start) {
        start += 1;
    }
    if start > 0 {
        if let Some(nl) = t[start..].find('\n') {
            start += nl + 1;
        }
    }
    messages.push(json!({
        "role": "user",
        "content": format!(
            "Your thinking was cut off. Your plan so far:\n{}\nMake the tool calls from that plan now, then reply in one sentence.",
            t[start..].trim()
        ),
    }));
}

/// An undo label from a prompt: "Agent: " and its first few words.
pub fn label(prompt: &str) -> String {
    const MOST: usize = 32;
    let words = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
    if words.chars().count() <= MOST {
        return format!("Agent: {words}");
    }
    let mut out = String::new();
    for w in words.split(' ') {
        if out.chars().count() + w.chars().count() + 1 > MOST {
            break;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(w);
    }
    if out.is_empty() {
        out = words.chars().take(MOST).collect();
    }
    format!("Agent: {out}…")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::{Call, Turn};
    use crate::tools::{Tool, Tools};

    /// Plays back scripted turns, each a list of deltas and the turn they
    /// end in.
    struct Script(Vec<(Vec<Delta>, Turn)>, Vec<Instant>);

    impl Model for Script {
        fn turn(
            &mut self,
            _: &Json,
            deadline: Instant,
            _: &AtomicBool,
            on: &mut dyn FnMut(Delta),
        ) -> Result<Turn, Failure> {
            self.1.push(deadline);
            let (deltas, turn) = self.0.remove(0);
            deltas.into_iter().for_each(&mut *on);
            Ok(turn)
        }
    }

    struct Bare(Tools);

    impl Toolbox for Bare {
        fn tools(&self) -> &Tools {
            &self.0
        }
        fn call(&mut self, _: &Tool, _: &Json) -> Result<String, String> {
            Ok("ok".into())
        }
    }

    fn phases(model: &mut Script, load: Option<Load>) -> Vec<Event> {
        let mut toolbox = Bare(Tools::new(Vec::new()));
        let ask = Ask {
            model: "m",
            system: "s",
            user: "u".into(),
            quick: true,
            limits: Limits::quick(),
            sampling: Sampling::default(),
            load,
        };
        let mut seen = Vec::new();
        reply(
            model,
            &mut toolbox,
            &ask,
            &AtomicBool::new(false),
            &mut |e| seen.push(e),
        );
        seen.into_iter()
            .filter(|e| matches!(e, Event::Phase { .. }))
            .collect()
    }

    fn phase(p: Phase) -> Event {
        Event::Phase {
            phase: p,
            model: None,
            seconds: None,
        }
    }

    fn turn(text: &str, calls: Vec<Call>) -> Turn {
        Turn {
            text: text.into(),
            calls,
            finish: Some("stop".into()),
        }
    }

    #[test]
    fn a_load_holds_until_the_model_speaks_then_thinking_and_answering_once_each() {
        let mut m = Script(
            vec![(
                vec![
                    Delta::Reasoning("a".into()),
                    Delta::Reasoning("b".into()),
                    Delta::Text("c".into()),
                    Delta::Text("d".into()),
                ],
                turn("cd", vec![]),
            )],
            vec![],
        );
        let got = phases(&mut m, Some(Load { seconds: Some(7.0) }));
        assert_eq!(
            got,
            vec![
                Event::Phase {
                    phase: Phase::Loading,
                    model: Some("m".into()),
                    seconds: Some(7.0),
                },
                phase(Phase::Thinking),
                phase(Phase::Answering),
            ]
        );
    }

    #[test]
    fn a_turn_of_only_tool_calls_goes_from_waiting_to_answering() {
        let call = Call {
            id: "a".into(),
            name: "nope".into(),
            arguments: "{}".into(),
        };
        let mut m = Script(
            vec![
                (
                    vec![Delta::Calling],
                    Turn {
                        text: String::new(),
                        calls: vec![call],
                        finish: Some("tool_calls".into()),
                    },
                ),
                (vec![Delta::Text("done".into())], turn("done", vec![])),
            ],
            vec![],
        );
        // No load: it starts at waiting. The second turn waits again after
        // the first answered, but never repeats a phase back to back.
        assert_eq!(
            phases(&mut m, None),
            vec![
                phase(Phase::Waiting),
                phase(Phase::Answering),
                phase(Phase::Waiting),
                phase(Phase::Answering),
            ]
        );
    }

    #[test]
    fn a_phase_crosses_as_tagged_json_with_its_extras_only_when_set() {
        let e = serde_json::to_value(Event::Phase {
            phase: Phase::Loading,
            model: Some("m".into()),
            seconds: Some(2.5),
        })
        .unwrap();
        assert_eq!(
            e,
            json!({ "kind": "phase", "phase": "loading", "model": "m", "seconds": 2.5 })
        );
        assert_eq!(
            serde_json::to_value(phase(Phase::Waiting)).unwrap(),
            json!({ "kind": "phase", "phase": "waiting" })
        );
    }

    #[test]
    fn the_deadline_the_model_is_given_includes_the_load() {
        let deadline = |load| {
            let mut m = Script(vec![(vec![], turn("", vec![]))], vec![]);
            let before = Instant::now();
            phases(&mut m, load);
            m.1[0].duration_since(before)
        };
        let plain = deadline(None);
        let loading = deadline(Some(Load { seconds: Some(7.0) }));
        let (lo, hi) = (Duration::from_secs(60), Duration::from_secs(61));
        assert!(plain >= lo && plain < hi, "{plain:?}");
        let (lo, hi) = (Duration::from_secs(84), Duration::from_secs(85));
        assert!(loading >= lo && loading < hi, "{loading:?}");
    }

    #[test]
    fn a_load_adds_twice_its_estimate_and_ten_seconds_or_a_minute_without_one() {
        assert_eq!(
            load_allowance(&Load { seconds: Some(7.0) }),
            Duration::from_secs(24)
        );
        assert_eq!(
            load_allowance(&Load { seconds: None }),
            Duration::from_secs(60)
        );
    }

    #[test]
    fn a_label_is_the_prompts_first_words() {
        assert_eq!(label("a funky beat"), "Agent: a funky beat");
        assert_eq!(
            label("a dark  bassline in F minor with lots of movement and ghost notes"),
            "Agent: a dark bassline in F minor with…"
        );
    }

    #[test]
    fn events_cross_as_tagged_json() {
        let e = serde_json::to_value(Event::Stopped {
            reason: Reason::Time,
        })
        .unwrap();
        assert_eq!(e, json!({ "kind": "stopped", "reason": "time" }));
        let d = serde_json::to_value(Event::Done {
            applied: true,
            label: "Agent: x".into(),
        })
        .unwrap();
        assert_eq!(
            d,
            json!({ "kind": "done", "applied": true, "label": "Agent: x" })
        );
    }
}
