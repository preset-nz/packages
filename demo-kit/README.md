# demo-kit

Tools that drive a real app window from outside, record it and cut the take into a demo video. Dev tooling for the preset.nz desktop apps: not published anywhere, and nothing in it ships in an app. Each app keeps only its choreography; plan and decisions are in the guidance repo, `projects/demo-kit/`.

Swift tools in `swift/`, built to `../target/demo/`:

| Tool | Usage |
|---|---|
| `ax` | `ax dump [filter]`, `ax find <name> [n]`, `ax next <name> <role> [n]`, `ax slider <label> [n]`, `ax window [x y w h]`. Finds the app from `DEMO_BUNDLE_ID` or `DEMO_APP_NAME` (either matching); exits with a message when neither is set |
| `ui` | `ui move x y`, `click`, `dclick`, `drag x1 y1 x2 y2 [ms]`, `type "text"`, `key <code> [cmd\|shift\|opt\|ctrl…]`, `hold <code> <ms>`, `pos` |
| `rec` | `rec <out.mov> <seconds> [x y w h] [--no-audio]`: ScreenCaptureKit, 2×, 60 fps, with system audio unless `--no-audio` |
| `display` | `display` prints the mode; `display <w> <h>` switches to that 2× mode, for this login |
| `label` | `label <text> <out.png> <height px> [background hex\|-] [text hex] [font]`: a caption plate as a PNG |

`demokit/` is Python 3.11+, standard library only: `Tools` (the tools and System Events menus, `stage`, `relaunch`, `display_restored`), `Take` (records, and writes `<out>.json`) and `edit` (cuts the take).

## How an app calls it

By path. The app's `just` recipe builds the tools, then runs its own script:

```
just -f ../../packages/demo-kit/justfile build     # or `just demo-kit::build` from packages/
python3 scripts/demo/<app>_demo.py
```

```python
import sys, pathlib
sys.path.insert(0, str(pathlib.Path.home() / "rhizomatic-preset/packages/demo-kit"))
from demokit.tools import Tools
from demokit.take import Take
from demokit.edit import edit

tools = Tools(BIN, process="shard", bundle_id="nz.preset.shard")
with tools.display_restored():
    frame = tools.stage()
    with Take(tools, out, frame, audio=True, meta={"product": "Shard", "commit": "abc1234"}) as take:
        tools.menu("View", "Patch", note=take.note)
        take.chapter("Shaping the bass")
        with take.wait("The model thinking"):
            ...
edit(out, title="…", description="…")
```

Launching the app (its command and readiness probe), canvas mapping and file dialogs stay in the app.

`edit(..., end_still=("end.png", 3))` holds an image after the last frame (letterboxed on #1a1a1a, the mark over it, silence under it with audio). `python3 -m demokit.edit <take.mov> [--plate hex] [--title …] [--end-still PATH --end-seconds N]` recuts from the `.json`.

## The take file

Times are seconds from the recording's start.

```json
{
  "waits": [[12.0, 40.5, "The model thinking"]],
  "captions": [[3.2, "View › Patch", 1.8]],
  "chapters": [[0.0, "The empty session"]],
  "audio": true,
  "meta": {"product": "Shard", "version": "0.1.0", "commit": "abc1234", "date": "2026-11-04T10:00:00+13:00"}
}
```

Each wait is sped up under its own `▶▶ 6×  <label>` plate and is a chapter of its own; captions inside a wait are dropped. With `"audio": false` the edit has no audio chain and no silence check.

## Recipes

`just demo-kit::build` compiles the tools when their source is newer. `just demo-kit::check` typechecks the Swift and runs the Python tests (`unittest`, no ffmpeg).
