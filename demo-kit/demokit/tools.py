"""The Swift tools (ax, ui, display, rec) and System Events, from Python.

Nothing here knows an app: the caller says its process name and bundle id.
"""

import contextlib
import os
import pathlib
import subprocess
import tempfile
import time
from collections.abc import Callable, Iterator


def _osa_quote(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


class Tools:
    def __init__(self, bin_dir: pathlib.Path | str, process: str, bundle_id: str):
        """`bin_dir` holds the built tools; `process` is the app's process
        and localized name (System Events, ax); `bundle_id` its bundle id."""
        self.bin = pathlib.Path(bin_dir)
        self.process = process
        self.bundle_id = bundle_id
        self.env = {**os.environ, "DEMO_APP_NAME": process, "DEMO_BUNDLE_ID": bundle_id}

    # -- ax, ui, display ---------------------------------------------------

    def ax_raw(self, *args) -> subprocess.CompletedProcess:
        return subprocess.run([self.bin / "ax", *map(str, args)], capture_output=True, text=True, env=self.env)

    def ax(self, *args) -> list[int]:
        # A webview rebuilds its tree as it renders: a miss is retried briefly.
        for _ in range(20):
            out = self.ax_raw(*args)
            if out.returncode == 0:
                return [int(v) for v in out.stdout.split()]
            time.sleep(0.25)
        raise SystemExit(f"ax {' '.join(map(str, args))}: {out.stderr.strip()}")

    def ui(self, *args) -> None:
        subprocess.run([self.bin / "ui", *map(str, args)], check=True)

    def click(self, name: str, n: int = 1) -> None:
        x, y, *_ = self.ax("find", name, n)
        self.ui("click", x, y)

    def slide(self, label: str, to: float, n: int = -1, ms: int = 1400) -> None:
        """Drags the slider after the text `label` to fraction `to` of its track."""
        thumb, y, x0, w = self.ax("slider", label, n)
        self.ui("drag", thumb, y, round(x0 + to * w), y, ms)

    def display(self, *size) -> list[int]:
        """With no size, the main display's mode: w h pixelW pixelH. With one,
        switches to its 2x mode first."""
        out = subprocess.run([self.bin / "display", *map(str, size)], capture_output=True, text=True)
        if out.returncode:
            raise SystemExit(f"display {' '.join(map(str, size))}: {out.stderr.strip()}")
        return [int(v) for v in out.stdout.split()]

    @contextlib.contextmanager
    def display_restored(self) -> Iterator[list[int]]:
        """Puts the display back as it was however the run ends."""
        before = self.display()
        try:
            yield before
        finally:
            self.display(*before[:2])

    # -- System Events -----------------------------------------------------

    def _osa(self, script: str, **kw) -> subprocess.CompletedProcess:
        return subprocess.run(["osascript", "-e", script], capture_output=True, text=True, **kw)

    def _bar_item(self, bar: str) -> str:
        return f'menu bar item {_osa_quote(bar)} of menu bar 1'

    def menu(self, bar: str, item: str, *, note: Callable[[str], None] | None = None) -> None:
        """Clicks a menu item by name. `note` (a Take's) captions it."""
        if note:
            note(f"{bar} › {item}")
        script = (f'tell application "System Events" to tell process {_osa_quote(self.process)} to '
                  f'click menu item {_osa_quote(item)} of menu 1 of {self._bar_item(bar)}')
        out = self._osa(script)
        if out.returncode:
            raise SystemExit(f"menu {bar} › {item}: {out.stderr.strip()}")

    def menu_path(self, bar: str, submenu: str, item: str, *, note: Callable[[str], None] | None = None) -> None:
        """Clicks an item one level down: File › Export › Map as PDF…"""
        if note:
            note(f"{bar} › {submenu} › {item}")
        script = (f'tell application "System Events" to tell process {_osa_quote(self.process)} to '
                  f'click menu item {_osa_quote(item)} of menu 1 of menu item {_osa_quote(submenu)} '
                  f'of menu 1 of {self._bar_item(bar)}')
        out = self._osa(script)
        if out.returncode:
            raise SystemExit(f"menu {bar} › {submenu} › {item}: {out.stderr.strip()}")

    def menu_marked(self, bar: str, item: str) -> bool:
        """Whether a toggle item carries a check mark."""
        script = (f'tell application "System Events" to tell process {_osa_quote(self.process)} to get value of '
                  f'attribute "AXMenuItemMarkChar" of menu item {_osa_quote(item)} of menu 1 of {self._bar_item(bar)}')
        mark = self._osa(script).stdout.strip()
        return mark not in ("", "missing value")

    def frontmost(self) -> None:
        self._osa(f'tell application "System Events" to tell process {_osa_quote(self.process)} to set frontmost to true')

    def keystroke(self, text: str) -> None:
        """Types `text` through System Events. Unlike `ui type`/`ui key`, these reach a
        Save panel: it is a remote service window, and `ui key`'s Return and Cmd chords
        never arrive there (found on Map & Territory, 2026-11-04)."""
        self._osa(f'tell application "System Events" to keystroke {_osa_quote(text)}', check=True)

    def key_code(self, code: int, *mods: str) -> None:
        """A key by code through System Events, with modifiers ("command", "shift",
        "option", "control"): Return is 36, Escape 53."""
        using = f' using {{{", ".join(m + " down" for m in mods)}}}' if mods else ""
        self._osa(f'tell application "System Events" to key code {code}{using}', check=True)

    def save_panel(self, path: pathlib.Path | str, settle: float = 1.0) -> None:
        """Saves through the open Save panel to `path`: the folder typed into Go to Folder
        (a leading "/" opens it), then the name over the selected one. The folder must
        exist; Go to Folder ignores Return on a path that doesn't. Wait for the app's own
        sign of the save afterwards, never a fixed time."""
        path = pathlib.Path(path)
        time.sleep(settle)  # the panel slides in
        self.keystroke(f"{path.parent}/")
        time.sleep(settle)  # Go to Folder suggests before it takes Return
        self.key_code(36)
        time.sleep(settle)
        self.key_code(0, "command")  # "a": the whole name, extension too
        self.keystroke(path.name)
        time.sleep(0.4)
        self.key_code(36)

    def window(self, x: int, y: int, w: int, h: int) -> list[int]:
        """Moves and sizes the main window (leaving full screen): x y w h in points."""
        return self.ax("window", x, y, w, h)

    def stage(self, screen=(2056, 1329), window=(1920, 1200), menu_bar=38) -> list[int]:
        """The display at `screen` points and the window at `window` in the
        middle of it, frontmost. Returns the window's frame, x y w h. The app
        is already running: launching it is the caller's (see `relaunch`).
        Wrap the run in `display_restored()`."""
        self.display(*screen)
        time.sleep(2.5)  # the display settles, and windows move to fit
        w, h = window
        x, y = (screen[0] - w) // 2, (screen[1] - h + menu_bar) // 2
        frame = self.window(x, y, w, h)
        if frame[2:] != [w, h]:
            raise SystemExit(f"the window is {frame[2]}x{frame[3]}, not {w}x{h}")
        self.frontmost()
        time.sleep(1)
        return frame

    # -- launching ---------------------------------------------------------

    def relaunch(self, cmd, ready: Callable[[], bool], kill: str | None = None,
                 log: pathlib.Path | str | None = None, cwd: pathlib.Path | str | None = None) -> None:
        """Kills the process named `kill` if given (unsaved work and all),
        starts `cmd` detached with its log in `log` (keep it outside any
        repo: a write under it can reload a webview), and polls `ready()`
        once a second for 5 minutes."""
        if kill:
            subprocess.run(["pkill", "-x", kill])
            for _ in range(40):
                if subprocess.run(["pgrep", "-x", kill], capture_output=True).returncode:
                    break
                time.sleep(0.25)
        log = pathlib.Path(log) if log else pathlib.Path(tempfile.gettempdir()) / "demo-run.log"
        with log.open("w") as f:
            subprocess.Popen(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
        for _ in range(300):
            time.sleep(1)
            if ready():
                return
        raise SystemExit(f"{self.process} didn't start in 5 minutes; see {log}")
