"""A take: the recording, and the times the edit needs written beside it."""

import contextlib
import json
import pathlib
import signal
import subprocess
import time
from collections.abc import Iterator

from .tools import Tools


class Take:
    """A context manager. Starts `rec` on the frame (x y w h, points) and
    stops it with SIGINT on exit; then writes `<out>.json`:

        {"waits": [[from, to, label]], "captions": [[t, text, shown]],
         "chapters": [[t, title]], "audio": bool, "meta": {...}}

    Times are seconds from the recording's start. `meta` is whatever the app
    passes: product, version, commit, build, date and so on.
    """

    def __init__(self, tools: Tools, out: pathlib.Path | str, frame, audio: bool = True,
                 meta: dict | None = None, max_seconds: int = 600):
        self.tools = tools
        self.out = pathlib.Path(out)
        self.frame = list(frame)
        self.audio = audio
        self.meta = meta or {}
        self.max_seconds = max_seconds
        self.waits: list[tuple[float, float, str]] = []
        self.captions: list[tuple[float, str, float]] = []
        self.chapters: list[tuple[float, str]] = []
        self._t0: float | None = None
        self._rec: subprocess.Popen | None = None

    @property
    def json_path(self) -> pathlib.Path:
        return self.out.with_suffix(".json")

    def now(self) -> float:
        if self._t0 is None:
            raise RuntimeError("the take isn't recording")
        return time.monotonic() - self._t0

    def __enter__(self) -> "Take":
        cmd = [self.tools.bin / "rec", self.out, str(self.max_seconds), *map(str, self.frame)]
        if not self.audio:
            cmd.append("--no-audio")
        self.out.parent.mkdir(parents=True, exist_ok=True)
        self._rec = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
        line = self._rec.stdout.readline().strip()
        if line != "recording":
            self._rec.wait(timeout=30)
            raise SystemExit(f"rec: {line or 'no output'}")
        self._t0 = time.monotonic()
        return self

    def __exit__(self, *exc) -> None:
        self._rec.send_signal(signal.SIGINT)
        try:
            self._rec.wait(timeout=30)
        finally:
            self.json_path.write_text(json.dumps(self.document(), ensure_ascii=False, indent=1))

    def document(self) -> dict:
        return {"waits": [list(w) for w in self.waits], "captions": [list(c) for c in self.captions],
                "chapters": [list(c) for c in self.chapters], "audio": self.audio, "meta": self.meta}

    def note(self, caption: str, seconds: float = 1.8) -> None:
        """A caption for the edit's bottom centre, the way a key display shows
        a press: every menu command and held key, since a click shows itself."""
        self.captions.append((self.now(), caption, seconds))

    def chapter(self, title: str) -> None:
        """A chapter starting now."""
        self.chapters.append((self.now(), title))

    @contextlib.contextmanager
    def wait(self, label: str = "") -> Iterator[None]:
        """A stretch the edit speeds up, labelled on its plate."""
        start = self.now()
        try:
            yield
        finally:
            self.waits.append((start, self.now(), label))
