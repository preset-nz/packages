# agent-kit

The Rust crate `preset-agent-kit`: the local-model client, the tool loop, the tool types and the run log, lifted from Shard. Planning is in the guidance repo, `~/rhizomatic-preset/guidance/projects/agent-kit/`; read it before changing anything here.

- No app names in code or comments. An app plugs in through `tools::Toolbox`; this crate knows no document model, no Tauri and no POM.
- Comments keep the reason a behaviour exists (a model's sampling, the loop guard) and drop the app that found it.
- Gates for any change: `~/rhizomatic-preset/guidance/runbooks/changing-a-shared-package.md`.
- `just agent-kit::check` from the root, or `just check` here.
