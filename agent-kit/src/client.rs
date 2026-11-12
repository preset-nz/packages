//! One OpenAI-compatible chat client, local first: LM Studio, Ollama,
//! llama.cpp's server, or any service speaking the same API
//! (`projects/agent-kit` in the guidance repo). Plain HTTP over `ureq`, on the
//! caller's thread, which is never a UI thread.
//!
//! A turn streams: text and reasoning reach the caller as they arrive, and
//! tool calls are put together from their deltas by index. The wall-clock
//! budget is checked on every line, and a global timeout on the request
//! catches a stream that stalls without sending one.

use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as Json};

/// Where the model is, as Settings holds it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub base_url: String,
    pub model: String,
    pub sampling: Sampling,
    /// Sent as `Authorization: Bearer` on every request when it isn't empty.
    /// oMLX wants one on every call; LM Studio and Ollama want none. Never
    /// logged or written out with a run.
    pub api_key: String,
}

/// One mode's sampling. `top_k` and `min_p` are extensions to the OpenAI
/// API that LM Studio, llama.cpp and Ollama accept.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Preset {
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: u32,
    pub min_p: f64,
    pub presence_penalty: f64,
}

/// Sampling per mode. The defaults are Qwen3's recommended values
/// (huggingface.co/Qwen/Qwen3.6-35B-A3B, "Best Practices"): thinking
/// 0.6 / 0.95 / 20 / 0, non-thinking 0.7 / 0.8 / 20 / 0. Greedy or unset
/// sampling in thinking mode is what Qwen warns causes endless repetition;
/// considered adds a presence penalty of 1.0 against it (the card allows 0
/// to 2), quick none, since a number in a tool's arguments repeats legitimately.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Sampling {
    pub quick: Preset,
    pub considered: Preset,
}

impl Default for Sampling {
    fn default() -> Self {
        Self {
            quick: Preset {
                temperature: 0.7,
                top_p: 0.8,
                top_k: 20,
                min_p: 0.0,
                presence_penalty: 0.0,
            },
            considered: Preset {
                temperature: 0.6,
                top_p: 0.95,
                top_k: 20,
                min_p: 0.0,
                presence_penalty: 1.0,
            },
        }
    }
}

impl Default for Preset {
    fn default() -> Self {
        Sampling::default().quick
    }
}

impl Sampling {
    pub fn for_mode(&self, quick: bool) -> &Preset {
        if quick {
            &self.quick
        } else {
            &self.considered
        }
    }
}

/// The model servers the family knows: a name and an OpenAI-compatible base
/// URL. The first is the default; apps draw their server dropdown from this.
pub const KNOWN_SERVERS: &[(&str, &str)] = &[
    ("oMLX", "http://localhost:8000/v1"),
    ("LM Studio", "http://localhost:1234/v1"),
];

/// The address a base URL is at, for a message: host and port, no scheme and
/// no path (`http://localhost:8000/v1` is `localhost:8000`).
pub fn address(base_url: &str) -> String {
    let u = base_url.trim();
    let u = u.split_once("://").map_or(u, |(_, rest)| rest);
    u.split('/').next().unwrap_or(u).to_string()
}

/// " at localhost:8000", or nothing when the address isn't known.
fn at(base_url: &str) -> String {
    match address(base_url) {
        a if a.is_empty() => String::new(),
        a => format!(" at {a}"),
    }
}

impl Default for Settings {
    /// oMLX (the first of [`KNOWN_SERVERS`]), and whatever model it has loaded.
    fn default() -> Self {
        Self {
            base_url: KNOWN_SERVERS[0].1.into(),
            model: String::new(),
            sampling: Sampling::default(),
            api_key: String::new(),
        }
    }
}

/// Whether a model setting means "whatever is loaded".
pub fn is_auto(model: &str) -> bool {
    let m = model.trim();
    m.is_empty() || m.eq_ignore_ascii_case("auto")
}

/// Where LM Studio lists its models with their state: its own REST API,
/// beside the OpenAI-compatible one.
pub fn models_url(base_url: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    let root = base.strip_suffix("/v1").unwrap_or(base);
    format!("{root}/api/v0/models")
}

/// Where oMLX lists its models with their state: beside the OpenAI-compatible
/// listing, under the same `/v1`.
pub fn status_url(base_url: &str) -> String {
    format!("{}/models/status", base_url.trim().trim_end_matches('/'))
}

/// A server's listing of its models with their state, by who sent it. The
/// two differ in what a model that isn't loaded costs, so the pick rule
/// differs too.
#[derive(Debug, Clone, PartialEq)]
pub enum Listing {
    /// `/api/v0/models`.
    LmStudio(Json),
    /// `/v1/models/status`.
    Omlx(Json),
}

/// A model that has to load before it can answer, and about how long that
/// takes, when the server's listing can say.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Load {
    pub seconds: Option<f32>,
}

/// The model a reply asks, and the load it waits for first.
#[derive(Debug, Clone, PartialEq)]
pub struct Chosen {
    pub id: String,
    pub load: Option<Load>,
}

impl Chosen {
    fn ready(id: &str) -> Self {
        Self {
            id: id.to_string(),
            load: None,
        }
    }
}

/// The model a reply asks, from the server's listing, or none when the
/// server has no such listing (Ollama, llama.cpp).
///
/// LM Studio loads a model a request names if it isn't loaded, 20 GB or
/// more, into memory it doesn't manage, so a model that isn't loaded is never
/// named: only one listed as `loaded`, of type `llm` or `vlm`. "Auto" (or
/// empty) takes the first such; a named model is taken only while it is
/// loaded. oMLX keeps to a memory ceiling and evicts the least recently used
/// model itself, so a named model is asked whether or not it is loaded, and
/// the reply starts with its load; "auto" still takes only a loaded one,
/// since there is no one model to load. With no listing, the named model is
/// taken on trust.
pub fn pick_model(listing: Option<&Listing>, configured: &str) -> Result<Chosen, String> {
    pick_model_at(listing, configured, "")
}

/// [`pick_model`], with the server's base URL so an error says which server
/// it asked. With an empty `base_url` the messages leave the address out.
pub fn pick_model_at(
    listing: Option<&Listing>,
    configured: &str,
    base_url: &str,
) -> Result<Chosen, String> {
    let configured = configured.trim();
    match listing {
        None if is_auto(configured) => Err(
            "No model is set, and the server doesn't say which one is loaded. Name one in Settings, then ask again."
                .into(),
        ),
        None => Ok(Chosen::ready(configured)),
        Some(Listing::LmStudio(l)) => pick_lm_studio(l, configured, base_url),
        Some(Listing::Omlx(l)) => pick_omlx(l, configured, base_url),
    }
}

fn pick_lm_studio(listing: &Json, configured: &str, base_url: &str) -> Result<Chosen, String> {
    let at = at(base_url);
    let loaded: Vec<&str> = listing
        .get("data")
        .and_then(Json::as_array)
        .into_iter()
        .flatten()
        .filter(|m| matches!(m.get("type").and_then(Json::as_str), Some("llm" | "vlm")))
        .filter(|m| m.get("state").and_then(Json::as_str) == Some("loaded"))
        .filter_map(|m| m.get("id").and_then(Json::as_str))
        .collect();
    if is_auto(configured) {
        return loaded.first().map(|m| Chosen::ready(m)).ok_or_else(|| {
            format!(
                "No model loaded in LM Studio{at}. Load one there, or pick another server in Settings."
            )
        });
    }
    if loaded.contains(&configured) {
        Ok(Chosen::ready(configured))
    } else {
        Err(format!(
            "{configured} isn't loaded in LM Studio{at}. Load it there, or pick another server in Settings."
        ))
    }
}

/// The chat models (`llm`, `vlm`) in oMLX's listing.
fn omlx_chat_models(listing: &Json) -> impl Iterator<Item = &Json> {
    listing
        .get("models")
        .and_then(Json::as_array)
        .into_iter()
        .flatten()
        .filter(|m| {
            matches!(
                m.get("model_type").and_then(Json::as_str),
                Some("llm" | "vlm")
            )
        })
}

fn pick_omlx(listing: &Json, configured: &str, base_url: &str) -> Result<Chosen, String> {
    let at = at(base_url);
    let flag = |m: &Json, k: &str| m.get(k).and_then(Json::as_bool).unwrap_or(false);
    let id = |m: &Json| m.get("id").and_then(Json::as_str).map(str::to_string);
    if is_auto(configured) {
        return omlx_chat_models(listing)
            .find(|m| flag(m, "loaded"))
            .and_then(id)
            .map(|id| Chosen { id, load: None })
            .ok_or_else(|| {
                format!("No model is loaded in oMLX{at}. Pick one in Settings, then ask again.")
            });
    }
    let Some(model) =
        omlx_chat_models(listing).find(|m| m.get("id").and_then(Json::as_str) == Some(configured))
    else {
        return Err(format!(
            "oMLX{at} has no model called {configured}. Pick one in Settings, then ask again."
        ));
    };
    // A model that is mid-load is waited for like one that hasn't started.
    if flag(model, "loaded") && !flag(model, "is_loading") {
        return Ok(Chosen::ready(configured));
    }
    let size = model.get("estimated_size").and_then(Json::as_f64);
    let per_gb = listing
        .get("load_seconds_per_gb_estimate")
        .and_then(Json::as_f64);
    let seconds = size
        .zip(per_gb)
        .map(|(size, per_gb)| (size / 1e9 * per_gb) as f32)
        .filter(|s| s.is_finite() && *s >= 0.0);
    Ok(Chosen {
        id: configured.to_string(),
        load: Some(Load { seconds }),
    })
}

/// Something streamed before the turn ends.
#[derive(Debug, Clone, PartialEq)]
pub enum Delta {
    Text(String),
    Reasoning(String),
    /// The turn's first tool-call delta, sent once, so a reply that only
    /// calls tools can still say it has started answering.
    Calling,
}

/// A tool call, put together from its deltas.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Call {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

/// One turn's answer.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Turn {
    pub text: String,
    pub calls: Vec<Call>,
    /// `stop`, `tool_calls`, `length`, as the server said.
    pub finish: Option<String>,
}

/// Why a turn ended before its answer did.
#[derive(Debug, Clone, PartialEq)]
pub enum Failure {
    Cancelled,
    /// The reply's wall-clock budget ran out.
    Time,
    /// The model's own text was going round in circles (`Watch`).
    Looping,
    /// The server couldn't be reached or answered with an error.
    Http(String),
}

/// What answers a turn: the server, or a script in a test.
pub trait Model {
    /// The model to ask, from the setting: by default the setting itself,
    /// with no load to wait for.
    fn resolve(&mut self, configured: &str) -> Result<Chosen, String> {
        Ok(Chosen::ready(configured.trim()))
    }

    fn turn(
        &mut self,
        body: &Json,
        deadline: Instant,
        cancel: &AtomicBool,
        on: &mut dyn FnMut(Delta),
    ) -> Result<Turn, Failure>;
}

/// A request's body. `quick` turns reasoning off; considered leaves the
/// server's default. `sampling` is that mode's preset. Never a `response_format`: a JSON schema forces the
/// reasoning block into JSON on LM Studio and the answer comes back empty.
pub fn body(
    model: &str,
    messages: &[Json],
    tools: &Json,
    quick: bool,
    max_tokens: u32,
    sampling: &Preset,
) -> Json {
    let mut b = json!({
        "model": model,
        "messages": messages,
        "tools": tools,
        "stream": true,
        "stream_options": { "include_usage": true },
        "max_tokens": max_tokens,
        "temperature": sampling.temperature,
        "top_p": sampling.top_p,
        "top_k": sampling.top_k,
        "min_p": sampling.min_p,
        "presence_penalty": sampling.presence_penalty,
    });
    if quick {
        // Two spellings of one request: LM Studio reads the first, oMLX the
        // second, and a server that reads neither ignores both. Without the
        // second a quick reply still thinks on oMLX.
        b["reasoning_effort"] = json!("none");
        b["chat_template_kwargs"] = json!({ "enable_thinking": false });
    }
    b
}

/// Watches one stream of text for going in circles. The text is lower-cased
/// with its whitespace collapsed, so a cycle that differs in line breaks
/// still matches. It loops when the last `TAIL` characters have already
/// occurred five times before in it: six passes over the same 400 characters.
/// A model wrapping up may restate a whole plan, JSON and all, two or
/// three times (seen live, and wrongly stopped at three passes); a real
/// degenerate loop cycles dozens of times, so six passes is the line.
/// Reasoning does not say 400 characters six times; a cycle of the real failure ("One check: ... I will output
/// the calls. One thought: ...", a dozen lines) is caught on its third
/// pass, not at the token cap.
#[derive(Debug, Default)]
pub struct Watch {
    seen: String,
    /// Whether the last character pushed was whitespace.
    space: bool,
    checked: usize,
}

impl Watch {
    const TAIL: usize = 400;
    /// How much new text to gather between checks.
    const EVERY: usize = 100;

    /// Adds text; true when the whole is now looping.
    pub fn push(&mut self, text: &str) -> bool {
        for c in text.chars() {
            if c.is_whitespace() {
                if !self.space && !self.seen.is_empty() {
                    self.seen.push(' ');
                }
                self.space = true;
            } else {
                self.seen.extend(c.to_lowercase());
                self.space = false;
            }
        }
        if self.seen.len() < Self::TAIL * 6 || self.seen.len() < self.checked + Self::EVERY {
            return false;
        }
        self.checked = self.seen.len();
        looping(&self.seen)
    }
}

/// Whether `text` (already normalised) ends with a 400-character stretch it
/// has already held five times before.
fn looping(text: &str) -> bool {
    let mut start = text.len() - Watch::TAIL;
    while !text.is_char_boundary(start) {
        start += 1;
    }
    let (before, tail) = text.split_at(start);
    before.matches(tail).take(5).count() >= 5
}

/// Puts a streamed answer together, one `data:` line at a time.
#[derive(Debug, Default)]
pub struct Stream {
    text: String,
    /// By the index the server gives each call.
    calls: Vec<(u64, Call)>,
    finish: Option<String>,
    done: bool,
    /// Whether `Delta::Calling` has been sent for this turn.
    calling: bool,
}

impl Stream {
    /// Reads one line of the event stream. Anything that isn't a `data:`
    /// line is skipped, and so is a chunk that doesn't parse.
    pub fn line(&mut self, line: &str, on: &mut dyn FnMut(Delta)) {
        let Some(data) = line.trim().strip_prefix("data:") else {
            return;
        };
        let data = data.trim();
        if data == "[DONE]" {
            self.done = true;
            return;
        }
        let Ok(chunk) = serde_json::from_str::<Json>(data) else {
            return;
        };
        for choice in chunk
            .get("choices")
            .and_then(Json::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(f) = choice.get("finish_reason").and_then(Json::as_str) {
                self.finish = Some(f.to_string());
            }
            let Some(delta) = choice.get("delta") else {
                continue;
            };
            let reasoning = delta
                .get("reasoning_content")
                .or_else(|| delta.get("reasoning"))
                .and_then(Json::as_str);
            if let Some(r) = reasoning.filter(|r| !r.is_empty()) {
                on(Delta::Reasoning(r.to_string()));
            }
            if let Some(c) = delta
                .get("content")
                .and_then(Json::as_str)
                .filter(|c| !c.is_empty())
            {
                self.text.push_str(c);
                on(Delta::Text(c.to_string()));
            }
            for tc in delta
                .get("tool_calls")
                .and_then(Json::as_array)
                .into_iter()
                .flatten()
            {
                if !self.calling {
                    self.calling = true;
                    on(Delta::Calling);
                }
                let index = tc.get("index").and_then(Json::as_u64).unwrap_or(0);
                let at = match self.calls.iter().position(|(i, _)| *i == index) {
                    Some(at) => at,
                    None => {
                        self.calls.push((index, Call::default()));
                        self.calls.len() - 1
                    }
                };
                let call = &mut self.calls[at].1;
                if let Some(id) = tc.get("id").and_then(Json::as_str) {
                    if call.id.is_empty() {
                        call.id = id.to_string();
                    }
                }
                if let Some(f) = tc.get("function") {
                    if let Some(n) = f.get("name").and_then(Json::as_str) {
                        call.name.push_str(n);
                    }
                    if let Some(a) = f.get("arguments").and_then(Json::as_str) {
                        call.arguments.push_str(a);
                    }
                }
            }
        }
    }

    pub fn is_done(&self) -> bool {
        self.done
    }

    pub fn finish(mut self) -> Turn {
        self.calls.sort_by_key(|(i, _)| *i);
        Turn {
            text: self.text,
            calls: self.calls.into_iter().map(|(_, c)| c).collect(),
            finish: self.finish,
        }
    }
}

/// The server, over plain HTTP.
pub struct Http {
    agent: ureq::Agent,
    base: String,
    url: String,
    models: String,
    status: String,
    key: String,
}

/// The `Authorization` header value for a key, or none when there is no key.
fn bearer(key: &str) -> Option<String> {
    let key = key.trim();
    (!key.is_empty()).then(|| format!("Bearer {key}"))
}

/// Whether a server's refusal is about a missing or wrong key: a 401, or
/// oMLX's own words under any status.
fn wants_key(status: u16, body: &str) -> bool {
    status == 401 || body.contains("API key required")
}

/// What a reply says when the server wants a key it wasn't given.
pub fn key_wanted(base: &str) -> String {
    format!("The server at {base} wants an API key. Add it in Settings, then ask again.")
}

impl Http {
    pub fn new(settings: &Settings) -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_connect(Some(Duration::from_secs(5)))
            // The body says what went wrong; read it rather than an error.
            .http_status_as_error(false)
            .build();
        Self {
            agent: ureq::Agent::new_with_config(config),
            base: settings.base_url.trim().trim_end_matches('/').to_string(),
            url: format!(
                "{}/chat/completions",
                settings.base_url.trim().trim_end_matches('/')
            ),
            models: models_url(&settings.base_url),
            status: status_url(&settings.base_url),
            key: settings.api_key.trim().to_string(),
        }
    }

    /// One listing request: its status and body. An error when nothing
    /// answers, or when the server wants a key it wasn't given.
    fn get(&self, url: &str) -> Result<(u16, String), String> {
        let mut request = self
            .agent
            .get(url)
            .config()
            .timeout_global(Some(Duration::from_secs(5)))
            .build();
        if let Some(auth) = bearer(&self.key) {
            request = request.header("Authorization", auth);
        }
        // Statuses aren't errors on this agent, so an error is the transport.
        let mut response = request.call().map_err(|_| unreachable(&self.base))?;
        let status = response.status().as_u16();
        let text = response.body_mut().read_to_string().unwrap_or_default();
        if wants_key(status, &text) {
            return Err(key_wanted(&self.base));
        }
        Ok((status, text))
    }

    /// The server's listing of its models with their state: LM Studio's,
    /// else oMLX's, or none when it has neither. An error when nothing
    /// answers at all.
    fn listing(&self) -> Result<Option<Listing>, String> {
        let parse = |(status, text): (u16, String), field: &str| {
            (200..300).contains(&status).then_some(())?;
            serde_json::from_str::<Json>(&text)
                .ok()
                .filter(|j| j.get(field).is_some_and(Json::is_array))
        };
        if let Some(j) = parse(self.get(&self.models)?, "data") {
            return Ok(Some(Listing::LmStudio(j)));
        }
        Ok(parse(self.get(&self.status)?, "models").map(Listing::Omlx))
    }
}

/// A model the server offers, for the Settings dropdown. `loaded` is known
/// only from LM Studio's and oMLX's listings; a plain OpenAI listing says
/// nothing of it.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ModelEntry {
    pub id: String,
    pub loaded: Option<bool>,
}

/// The chat models in a listing: LM Studio's (`/api/v0/models`, with type and
/// state, embeddings left out), oMLX's (`/v1/models/status`) or OpenAI's
/// (`/v1/models`, ids only).
pub fn model_entries(listing: &Json) -> Vec<ModelEntry> {
    if listing.get("models").is_some_and(Json::is_array) {
        return omlx_chat_models(listing)
            .filter_map(|m| {
                let id = m.get("id").and_then(Json::as_str)?.to_string();
                let loaded = m.get("loaded").and_then(Json::as_bool);
                Some(ModelEntry { id, loaded })
            })
            .collect();
    }
    listing
        .get("data")
        .and_then(Json::as_array)
        .into_iter()
        .flatten()
        .filter(|m| match m.get("type").and_then(Json::as_str) {
            Some(t) => matches!(t, "llm" | "vlm"),
            None => true,
        })
        .filter_map(|m| {
            let id = m.get("id").and_then(Json::as_str)?.to_string();
            let loaded = m.get("state").and_then(Json::as_str).map(|s| s == "loaded");
            Some(ModelEntry { id, loaded })
        })
        .collect()
}

impl Http {
    /// The models the server offers: LM Studio's listing, else oMLX's, else
    /// the OpenAI one, else none (the dialog then takes a typed name).
    pub fn models(&self) -> Result<Vec<ModelEntry>, String> {
        match self.listing()? {
            Some(Listing::LmStudio(j) | Listing::Omlx(j)) => return Ok(model_entries(&j)),
            None => {}
        }
        let (status, text) = self.get(&format!("{}/models", self.base))?;
        let openai = (200..300)
            .contains(&status)
            .then(|| serde_json::from_str::<Json>(&text).ok())
            .flatten();
        Ok(openai.as_ref().map(model_entries).unwrap_or_default())
    }
}

/// What a reply says when no server answers at the configured address.
pub fn unreachable(base: &str) -> String {
    format!("Nothing answers at {base}. Start the model server, then ask again.")
}

impl Model for Http {
    fn resolve(&mut self, configured: &str) -> Result<Chosen, String> {
        pick_model_at(self.listing()?.as_ref(), configured, &self.base)
    }

    fn turn(
        &mut self,
        body: &Json,
        deadline: Instant,
        cancel: &AtomicBool,
        on: &mut dyn FnMut(Delta),
    ) -> Result<Turn, Failure> {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Err(Failure::Time);
        }
        let late = || Instant::now() >= deadline;
        let mut request = self
            .agent
            .post(&self.url)
            .config()
            .timeout_global(Some(left))
            .build()
            .header("Content-Type", "application/json");
        if let Some(auth) = bearer(&self.key) {
            request = request.header("Authorization", auth);
        }
        let response = request.send(body.to_string()).map_err(|e| {
            if late() {
                Failure::Time
            } else {
                Failure::Http(format!("couldn't reach the model at {}: {e}", self.url))
            }
        })?;
        let status = response.status();
        let mut reader = BufReader::new(response.into_body().into_reader());
        if !status.is_success() {
            let mut text = String::new();
            let _ = std::io::Read::read_to_string(&mut reader, &mut text);
            if wants_key(status.as_u16(), &text) {
                return Err(Failure::Http(key_wanted(&self.base)));
            }
            let message = serde_json::from_str::<Json>(&text)
                .ok()
                .and_then(|j| {
                    j.pointer("/error/message")
                        .or_else(|| j.get("error"))
                        .and_then(Json::as_str)
                        .map(str::to_string)
                })
                .unwrap_or(text);
            return Err(Failure::Http(format!(
                "the model answered {}: {}",
                status.as_u16(),
                message.trim()
            )));
        }
        let mut stream = Stream::default();
        let (mut thinking, mut saying) = (Watch::default(), Watch::default());
        let mut line = String::new();
        loop {
            if cancel.load(Ordering::Acquire) {
                return Err(Failure::Cancelled);
            }
            if late() {
                return Err(Failure::Time);
            }
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    let mut looped = false;
                    stream.line(&line, &mut |d| {
                        looped |= match &d {
                            Delta::Reasoning(r) => thinking.push(r),
                            Delta::Text(t) => saying.push(t),
                            Delta::Calling => false,
                        };
                        on(d)
                    });
                    if looped {
                        return Err(Failure::Looping);
                    }
                    if stream.is_done() {
                        break;
                    }
                }
                Err(_) if late() => return Err(Failure::Time),
                Err(e) => return Err(Failure::Http(format!("the stream broke: {e}"))),
            }
        }
        Ok(stream.finish())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(lines: &[&str]) -> (Turn, Vec<Delta>) {
        let mut s = Stream::default();
        let mut seen = Vec::new();
        for l in lines {
            s.line(l, &mut |d| seen.push(d));
        }
        (s.finish(), seen)
    }

    #[test]
    fn tool_call_arguments_split_across_chunks_are_put_back_together() {
        let (turn, _) = read(&[
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","type":"function","function":{"name":"set_drums","arguments":""}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"hits\": [{\"st"}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ep\": 0, \"midi_note\": 36}]}"}}]}}]}"#,
            r#"data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}"#,
            "data: [DONE]",
        ]);
        assert_eq!(turn.calls.len(), 1);
        assert_eq!(turn.calls[0].id, "call_a");
        assert_eq!(turn.calls[0].name, "set_drums");
        let args: Json = serde_json::from_str(&turn.calls[0].arguments).unwrap();
        assert_eq!(args["hits"][0]["midi_note"], 36);
        assert_eq!(turn.finish.as_deref(), Some("tool_calls"));
    }

    #[test]
    fn two_calls_interleaved_keep_their_own_arguments_in_index_order() {
        let (turn, _) = read(&[
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","function":{"name":"set_melody","arguments":"{\"steps\""}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","function":{"name":"set_tempo","arguments":"{\"bpm\":"}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"arguments":": []}"}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":" 90}"}}]}}]}"#,
        ]);
        let names: Vec<&str> = turn.calls.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, ["set_tempo", "set_melody"]);
        assert_eq!(turn.calls[0].arguments, r#"{"bpm": 90}"#);
        assert_eq!(turn.calls[1].arguments, r#"{"steps": []}"#);
    }

    #[test]
    fn text_and_reasoning_stream_as_they_arrive_and_noise_is_skipped() {
        let (turn, seen) = read(&[
            ": keep-alive",
            "",
            r#"data: {"choices":[{"delta":{"reasoning_content":"Four on "}}]}"#,
            r#"data: {"choices":[{"delta":{"reasoning":"the floor."}}]}"#,
            r#"data: {"choices":[{"delta":{"content":"Done"}}]}"#,
            "data: not json",
            r#"data: {"choices":[{"delta":{"content":"."},"finish_reason":"stop"}],"usage":null}"#,
        ]);
        assert_eq!(
            seen,
            vec![
                Delta::Reasoning("Four on ".into()),
                Delta::Reasoning("the floor.".into()),
                Delta::Text("Done".into()),
                Delta::Text(".".into()),
            ]
        );
        assert_eq!(turn.text, "Done.");
        assert!(turn.calls.is_empty());
        assert_eq!(turn.finish.as_deref(), Some("stop"));
    }

    fn listing() -> Json {
        json!({ "object": "list", "data": [
            { "id": "text-embedding-qwen3-embedding-4b", "type": "embeddings", "state": "loaded" },
            { "id": "prism-ml/bonsai-27b", "type": "llm", "state": "not-loaded" },
            { "id": "qwen/qwen3.6-35b-a3b", "type": "llm", "state": "loaded" },
            { "id": "some/vision", "type": "vlm", "state": "loaded" },
        ] })
    }

    #[test]
    fn auto_takes_the_first_loaded_chat_model_and_never_one_that_isnt_loaded() {
        let l = listing();
        let l = Listing::LmStudio(l);
        let picked = |c: &str| pick_model(Some(&l), c).unwrap();
        assert_eq!(picked("").id, "qwen/qwen3.6-35b-a3b");
        assert_eq!(picked("Auto").id, "qwen/qwen3.6-35b-a3b");
        assert_eq!(picked("some/vision").id, "some/vision");
        assert_eq!(picked("some/vision").load, None);
        let e =
            pick_model_at(Some(&l), "prism-ml/bonsai-27b", "http://localhost:1234/v1").unwrap_err();
        assert_eq!(
            e,
            "prism-ml/bonsai-27b isn't loaded in LM Studio at localhost:1234. Load it there, or pick another server in Settings."
        );
        // An embeddings model is loaded, but it can't chat.
        let none = json!({ "data": [
            { "id": "text-embedding-qwen3-embedding-4b", "type": "embeddings", "state": "loaded" },
            { "id": "prism-ml/bonsai-27b", "type": "llm", "state": "not-loaded" },
        ] });
        assert_eq!(
            pick_model_at(Some(&Listing::LmStudio(none)), "", "http://localhost:1234/v1")
                .unwrap_err(),
            "No model loaded in LM Studio at localhost:1234. Load one there, or pick another server in Settings."
        );
    }

    #[test]
    fn the_dropdown_lists_chat_models_with_their_state() {
        let ids = |l: &Json| -> Vec<(String, Option<bool>)> {
            model_entries(l)
                .into_iter()
                .map(|m| (m.id, m.loaded))
                .collect()
        };
        assert_eq!(
            ids(&listing()),
            [
                ("prism-ml/bonsai-27b".into(), Some(false)),
                ("qwen/qwen3.6-35b-a3b".into(), Some(true)),
                ("some/vision".into(), Some(true)),
            ]
        );
        // OpenAI's listing: ids only, state unknown.
        let openai = json!({ "object": "list", "data": [{ "id": "llama3", "object": "model" }] });
        assert_eq!(ids(&openai), [("llama3".into(), None)]);
    }

    #[test]
    fn no_server_says_so_rather_than_asking_for_a_model() {
        // A port that was just free: nothing listens on it.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        let base = format!("http://127.0.0.1:{port}/v1");
        let mut http = Http::new(&Settings {
            base_url: format!("{base}/"),
            ..Settings::default()
        });
        assert_eq!(http.resolve("").unwrap_err(), unreachable(&base));
        assert_eq!(
            unreachable(&base),
            format!("Nothing answers at {base}. Start the model server, then ask again.")
        );
    }

    fn omlx() -> Json {
        json!({
            "final_ceiling": 33526890412u64,
            "loaded_count": 1,
            "load_seconds_per_gb_estimate": 0.99,
            "models": [
                { "id": "embed", "loaded": true, "is_loading": false,
                  "estimated_size": 600_000_000u64, "model_type": "embedding" },
                { "id": "mellum2.1-mxfp4", "loaded": false, "is_loading": false,
                  "estimated_size": 6_779_967_464u64, "model_type": "llm" },
                { "id": "qwen-loaded", "loaded": true, "is_loading": false,
                  "estimated_size": 20_000_000_000u64, "model_type": "llm" },
                { "id": "vision", "loaded": false, "is_loading": true,
                  "estimated_size": 10_000_000_000u64, "model_type": "vlm" },
            ]
        })
    }

    #[test]
    fn omlx_asks_a_named_model_loaded_or_not_and_says_what_it_waits_for() {
        let l = Listing::Omlx(omlx());
        let pick = |c: &str| pick_model_at(Some(&l), c, "http://localhost:8000/v1");
        // Loaded: nothing to wait for.
        assert_eq!(pick("qwen-loaded").unwrap(), Chosen::ready("qwen-loaded"));
        // Not loaded: asked anyway, with size x seconds per GB.
        let c = pick("mellum2.1-mxfp4").unwrap();
        assert_eq!(c.id, "mellum2.1-mxfp4");
        let s = c.load.unwrap().seconds.unwrap();
        assert!((s - 6.71).abs() < 0.01, "{s}");
        // Mid-load: waited for too.
        let c = pick("vision").unwrap();
        assert!((c.load.unwrap().seconds.unwrap() - 9.9).abs() < 0.01);
        // A model the server doesn't have, or can't chat with.
        assert_eq!(
            pick("nope").unwrap_err(),
            "oMLX at localhost:8000 has no model called nope. Pick one in Settings, then ask again."
        );
        assert!(pick("embed").is_err());
    }

    #[test]
    fn omlx_load_without_an_estimate_has_no_seconds() {
        let l = Listing::Omlx(json!({ "models": [
            { "id": "m", "loaded": false, "model_type": "llm" },
        ] }));
        assert_eq!(
            pick_model(Some(&l), "m").unwrap().load,
            Some(Load { seconds: None })
        );
    }

    #[test]
    fn omlx_auto_takes_the_first_loaded_chat_model_and_loads_nothing() {
        let l = Listing::Omlx(omlx());
        for auto in ["", "auto"] {
            assert_eq!(
                pick_model(Some(&l), auto).unwrap(),
                Chosen::ready("qwen-loaded")
            );
        }
        let none = Listing::Omlx(json!({ "models": [
            { "id": "embed", "loaded": true, "model_type": "embedding" },
            { "id": "m", "loaded": false, "model_type": "llm" },
        ] }));
        assert_eq!(
            pick_model_at(Some(&none), "", "http://localhost:8000/v1").unwrap_err(),
            "No model is loaded in oMLX at localhost:8000. Pick one in Settings, then ask again."
        );
    }

    #[test]
    fn the_dropdown_reads_omlx_too() {
        let got: Vec<_> = model_entries(&omlx())
            .into_iter()
            .map(|m| (m.id, m.loaded))
            .collect();
        assert_eq!(
            got,
            [
                ("mellum2.1-mxfp4".into(), Some(false)),
                ("qwen-loaded".into(), Some(true)),
                ("vision".into(), Some(false)),
            ]
        );
        assert_eq!(
            status_url("http://localhost:8000/v1/"),
            "http://localhost:8000/v1/models/status"
        );
    }

    #[test]
    fn a_key_goes_as_a_bearer_header_only_when_there_is_one() {
        assert_eq!(bearer(""), None);
        assert_eq!(bearer("  "), None);
        assert_eq!(bearer(" sk-1 \n").as_deref(), Some("Bearer sk-1"));
        let s: Settings = serde_json::from_str(r#"{"apiKey":"k"}"#).unwrap();
        assert_eq!(s.api_key, "k");
        // A settings file from before the key still loads, with none.
        let s: Settings = serde_json::from_str(r#"{"baseUrl":"http://x/v1"}"#).unwrap();
        assert_eq!(s.api_key, "");
    }

    /// Serves one canned response per connection and records each request's
    /// head, so what the client actually sent can be read.
    fn serve(
        status: &str,
        body: &'static str,
        times: usize,
    ) -> (String, std::thread::JoinHandle<Vec<String>>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}/v1", listener.local_addr().unwrap());
        let status = status.to_string();
        let handle = std::thread::spawn(move || {
            let mut heads = Vec::new();
            for _ in 0..times {
                let (mut conn, _) = listener.accept().unwrap();
                let mut buf = [0u8; 4096];
                let n = conn.read(&mut buf).unwrap();
                heads.push(String::from_utf8_lossy(&buf[..n]).to_lowercase());
                let _ = write!(
                    conn,
                    "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
            }
            heads
        });
        (base, handle)
    }

    #[test]
    fn a_server_that_wants_a_key_gets_one_and_says_so_when_it_has_none() {
        const REFUSAL: &str =
            r#"{"error":{"message":"API key required","type":"authentication_error"}}"#;
        // No key: both listing requests are refused, and the first ends it.
        let (base, served) = serve("401 Unauthorized", REFUSAL, 1);
        let mut http = Http::new(&Settings {
            base_url: base.clone(),
            ..Settings::default()
        });
        let want =
            format!("The server at {base} wants an API key. Add it in Settings, then ask again.");
        assert_eq!(http.resolve("").unwrap_err(), want);
        assert!(!served.join().unwrap()[0].contains("authorization"));
        // Chat says it the same way, whatever the status.
        let (base, served) = serve("403 Forbidden", REFUSAL, 1);
        let mut http = Http::new(&Settings {
            base_url: base.clone(),
            ..Settings::default()
        });
        let err = http
            .turn(
                &json!({}),
                Instant::now() + Duration::from_secs(5),
                &AtomicBool::new(false),
                &mut |_| {},
            )
            .unwrap_err();
        assert_eq!(err, Failure::Http(key_wanted(&base)));
        served.join().unwrap();
        // With a key: the header is sent, on a listing and on chat.
        let (base, served) = serve("401 Unauthorized", REFUSAL, 2);
        let http = Http::new(&Settings {
            base_url: base.clone(),
            api_key: "sk-test".into(),
            ..Settings::default()
        });
        let _ = http.models();
        let _ = Http::new(&Settings {
            base_url: base,
            api_key: "sk-test".into(),
            ..Settings::default()
        })
        .turn(
            &json!({}),
            Instant::now() + Duration::from_secs(5),
            &AtomicBool::new(false),
            &mut |_| {},
        );
        let heads = served.join().unwrap();
        assert!(
            heads
                .iter()
                .all(|h| h.contains("authorization: bearer sk-test")),
            "{heads:?}"
        );
        assert!(heads[1].starts_with("post "));
    }

    #[test]
    fn the_first_tool_call_delta_of_a_turn_says_calling_once() {
        let (turn, seen) = read(&[
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","function":{"name":"x","arguments":""}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","function":{"name":"y","arguments":"{}"}}]}}]}"#,
        ]);
        assert_eq!(seen, vec![Delta::Calling]);
        assert_eq!(turn.calls.len(), 2);
    }

    #[test]
    fn the_default_server_is_the_first_known_one_and_omlx() {
        assert_eq!(Settings::default().base_url, "http://localhost:8000/v1");
        assert_eq!(KNOWN_SERVERS[0], ("oMLX", "http://localhost:8000/v1"));
        assert!(KNOWN_SERVERS.contains(&("LM Studio", "http://localhost:1234/v1")));
    }

    #[test]
    fn an_address_is_host_and_port_only() {
        assert_eq!(address("http://localhost:8000/v1"), "localhost:8000");
        assert_eq!(address(" http://192.168.1.5:1234/v1/ "), "192.168.1.5:1234");
        assert_eq!(address("localhost:8000"), "localhost:8000");
        assert_eq!(address(""), "");
    }

    #[test]
    fn pick_model_without_an_address_leaves_it_out() {
        let none = Listing::Omlx(json!({ "models": [] }));
        assert_eq!(
            pick_model(Some(&none), "").unwrap_err(),
            "No model is loaded in oMLX. Pick one in Settings, then ask again."
        );
    }

    #[test]
    fn without_a_listing_the_named_model_is_taken_on_trust() {
        assert_eq!(
            pick_model(None, " llama3 ").unwrap(),
            Chosen::ready("llama3")
        );
        assert!(pick_model(None, "")
            .unwrap_err()
            .contains("Name one in Settings"));
        assert_eq!(
            models_url("http://localhost:1234/v1/"),
            "http://localhost:1234/api/v0/models"
        );
        assert_eq!(
            models_url("http://localhost:11434"),
            "http://localhost:11434/api/v0/models"
        );
    }

    #[test]
    fn quick_turns_reasoning_off_and_considered_leaves_it() {
        let tools = json!([]);
        let p = Sampling::default();
        let quick = body("m", &[], &tools, true, 8000, &p.quick);
        assert_eq!(quick["reasoning_effort"], "none");
        // oMLX reads this one; LM Studio the one above.
        assert_eq!(
            quick["chat_template_kwargs"],
            json!({ "enable_thinking": false })
        );
        let considered = body("m", &[], &tools, false, 8000, &p.considered);
        assert!(considered.get("reasoning_effort").is_none());
        assert!(considered.get("chat_template_kwargs").is_none());
        assert!(considered.get("response_format").is_none());
        assert_eq!(considered["max_tokens"], 8000);
    }

    #[test]
    fn each_mode_sends_its_own_sampling() {
        let tools = json!([]);
        let p = Sampling::default();
        let q = body("m", &[], &tools, true, 8000, &p.quick);
        let c = body("m", &[], &tools, false, 8000, &p.considered);
        assert_eq!(q["temperature"], 0.7);
        assert_eq!(q["top_p"], 0.8);
        assert_eq!(q["presence_penalty"], 0.0);
        assert_eq!(c["temperature"], 0.6);
        assert_eq!(c["top_p"], 0.95);
        assert_eq!(c["top_k"], 20);
        assert_eq!(c["min_p"], 0.0);
        assert_eq!(c["presence_penalty"], 1.0);
        // The same bytes every turn of a reply.
        assert_eq!(
            c.to_string(),
            body("m", &[], &tools, false, 8000, &p.considered).to_string()
        );
        // A settings file from before sampling still loads.
        let s: Settings = serde_json::from_str(r#"{"baseUrl":"http://x/v1","model":"m"}"#).unwrap();
        assert_eq!(s.sampling, p);
    }

    /// The failure seen live: the plan settled, then a dozen lines said
    /// over and over until the token cap.
    const CYCLE: &str = "One check: \"track 1\" -> track: \"Track 1\". This is correct.\nI will output the calls.\nOne thought: the user said baseline, so a bass line.\nOne more thought: set_tempo 175 first.\nThen set_melody with Track 1 and ten notes.\nWait, is G1 31? Yes, G1 = 31.\nNotes: 31, 31, 34, 31, 38, 31, 34, 31, 43, 31.\nHold values short for speedy.\nVelocity high for death metal.\nAll good.\nLet me double check the track name once more.\nOne check: ";

    #[test]
    fn a_cycle_of_the_same_lines_is_caught_after_many_passes() {
        let mut w = Watch::default();
        let mut caught = None;
        for pass in 1..=12 {
            // Streamed in small pieces, as tokens arrive.
            for piece in CYCLE.as_bytes().chunks(7) {
                if w.push(std::str::from_utf8(piece).unwrap()) {
                    caught = Some(pass);
                    break;
                }
            }
            if caught.is_some() {
                break;
            }
        }
        assert!(matches!(caught, Some(6..=9)), "caught on pass {caught:?}");
    }

    #[test]
    fn a_plan_restated_three_times_is_not_a_loop() {
        let plan = "[Tool Calls] set_tempo {\"bpm\": 175} set_melody {\"track\": \"Track 1\", \"length\": 16, \"steps\": [{\"step\": 1, \"note\": 43, \"velocity\": 127, \"hold\": 1}, {\"step\": 2, \"note\": 43, \"velocity\": 110, \"hold\": 1}, {\"step\": 4, \"note\": 41, \"velocity\": 120, \"hold\": 2}, {\"step\": 6, \"note\": 44, \"velocity\": 100, \"hold\": 1}, {\"step\": 9, \"note\": 43, \"velocity\": 127, \"hold\": 1}, {\"step\": 12, \"note\": 41, \"velocity\": 95, \"hold\": 2}, {\"step\": 14, \"note\": 44, \"velocity\": 105, \"hold\": 1}, {\"step\": 15, \"note\": 43, \"velocity\": 127, \"hold\": 1}]} ";
        assert!(plan.len() > 450);
        let mut w = Watch::default();
        let mut text = String::from("Planning the bass in G with chromatic neighbours. ");
        for stage in ["Output Generation", "Proceeds", "Done"] {
            text.push_str(stage);
            text.push_str(". ");
            text.push_str(plan);
        }
        for piece in text.as_bytes().chunks(9) {
            assert!(!w.push(std::str::from_utf8(piece).unwrap()));
        }
    }

    #[test]
    fn long_reasoning_that_reuses_its_phrases_is_not_a_loop() {
        let mut w = Watch::default();
        let mut text = String::new();
        for i in 0..200 {
            text.push_str(&format!(
                "Step {i}: the bass needs G1 = 31 and the hold is {} steps, so the note at step {} stays short. Check the tempo of 175 again. ",
                i % 4 + 1,
                i * 3 % 16 + 1
            ));
        }
        assert!(text.len() > 20_000);
        for piece in text.as_bytes().chunks(11) {
            assert!(!w.push(std::str::from_utf8(piece).unwrap()));
        }
    }
}
