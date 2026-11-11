# preset-agent-kit

A local-first agent for a desktop app. A model running on the user's own machine (LM Studio, Ollama, llama.cpp, anything speaking the OpenAI chat API) is shown the app's commands as tools, calls them to edit the open document, and the app takes the whole reply back as one undo step. Nothing leaves the machine.

Four modules:

- `client`: an OpenAI-compatible streaming chat client over `ureq`, with sampling presets for quick and considered replies, an optional API key, model listings from LM Studio, oMLX and plain OpenAI servers, and a watch that stops a model going in circles.
- `tools`: a command shown to a model (name, description, JSON Schema, read or write), and `Toolbox`, the seam. An app implements `Toolbox` over its own commands; the crate knows no app and no UI toolkit.
- `run`: the tool loop. Ask, run what the model calls, hand back the results, ask again. Every limit (tokens, wall-clock, turns, cancel) is reported, never silent. It also reports the phase a reply is in (loading, waiting, thinking, answering).
- `log`: every event of a run, written out as text or JSON lines for later investigation.

```toml
[dependencies]
preset-agent-kit = "0.2"
```

MIT. Part of [preset-nz/packages](https://github.com/preset-nz/packages).
