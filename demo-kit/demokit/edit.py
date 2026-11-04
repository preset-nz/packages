"""Cuts a take into a demo video: waits sped up under a plate, captions on the
same plate, the preset.nz mark, halved to H.264 for every browser, with title,
credits and chapters, a poster, and a silence check.

    python3 -m demokit.edit <take.mov> [--plate hex] [--title ...]

recuts from the take's `.json` (see take.py). The pure functions (`at`,
`plates`, `chapter_marks`, `chapters_text`, `filter_graph`) need no ffmpeg.
"""

import argparse
import datetime
import json
import pathlib
import subprocess
import sys

BIN = pathlib.Path(__file__).resolve().parents[2] / "target" / "demo"
PLATE = "49a8b3"  # ux-kit's dark primary: the captions' plate
# Until preset.nz has a logo: its name, lower left, on every frame.
MARK = ("preset.nz", "ffffff80", "DINAlternate-Bold")

Wait = tuple[float, float, str]


def removed(waits: list[Wait], speed: float, upto: float = float("inf")) -> float:
    """Seconds the speed-up takes off the waits that end by `upto`."""
    return sum((b - a) * (1 - 1 / speed) for a, b, _ in waits if b <= upto)


def at(waits: list[Wait], speed: float, t: float) -> float:
    """A time in the take, in the edit: through every wait before it."""
    for a, b, _ in waits:
        if a < t < b:
            return a - removed(waits, speed, a) + (t - a) / speed
    return t - removed(waits, speed, t)


def plates(waits: list[Wait], captions, speed: float) -> list[tuple[str, float, float]]:
    """(text, start, end) in the edit: a plate per wait, then each caption
    shifted, the ones inside a wait dropped."""
    out = []
    for a, b, label in waits:
        text = f"▶▶ {speed:g}×  {label}" if label else f"▶▶ {speed:g}×"
        start = at(waits, speed, a)
        out.append((text, start, start + (b - a) / speed))
    for t, text, shown in captions:
        if any(a < t < b for a, b, _ in waits):
            continue
        out.append((text, at(waits, speed, t), at(waits, speed, t) + shown))
    return out


def chapter_marks(waits: list[Wait], chapters, speed: float) -> list[tuple[float, str]]:
    """The take's chapters mapped through `at`, and each wait as its own."""
    marks = [(at(waits, speed, t), title) for t, title in chapters]
    marks += [(at(waits, speed, a), f"{label}, at {speed:g}×" if label else f"At {speed:g}×") for a, _, label in waits]
    return sorted(marks, key=lambda m: m[0])


def chapters_text(marks: list[tuple[float, str]], end: float) -> str:
    """An ffmetadata file of chapters, each running to the next."""
    lines = [";FFMETADATA1"]
    for (start, title), nxt in zip(marks, [m[0] for m in marks[1:]] + [end]):
        lines += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={round(start * 1000)}", f"END={round(nxt * 1000)}", f"title={title}"]
    return "\n".join(lines) + "\n"


def plate_texts(shown) -> list[str]:
    """The distinct plate texts in order: input i+1 of ffmpeg is plate i."""
    return list(dict.fromkeys(text for text, _, _ in shown))


def filter_graph(waits: list[Wait], speed: float, audio: bool, shown,
                 end_still: tuple | None = None, size: tuple[int, int] | None = None) -> str:
    """The -filter_complex string. Inputs: 0 the take, 1..n the plates (in
    `plate_texts` order), n+1 the mark, n+2 the end still when given (a
    looped image of `seconds`, `end_still` = (path, seconds), `size` the
    take's frame in pixels). Outputs [v], and [a] with audio. 2N+1 segments
    for N waits (an empty one is left out), plus one for the still, which is
    letterboxed on #1a1a1a and given silence of its length."""
    segs = []  # (start, end or None, fast)
    pos = 0.0
    for a, b, _ in sorted(waits):
        if a > pos:
            segs.append((pos, a, False))
        segs.append((a, b, True))
        pos = b
    segs.append((pos, None, False))

    parts, joined = [], ""
    for i, (s, e, fast) in enumerate(segs):
        span = f"{s:.3f}:{e:.3f}" if e is not None else f"{s:.3f}"
        pts = f"(PTS-STARTPTS)/{speed:g}" if fast else "PTS-STARTPTS"
        parts.append(f"[0:v]trim={span},setpts={pts}[v{i}]")
        joined += f"[v{i}]"
        if audio:
            tempo = f",atempo=2,atempo={speed / 2:g}" if fast else ""
            parts.append(f"[0:a]atrim={span},asetpts=PTS-STARTPTS{tempo}[a{i}]")
            joined += f"[a{i}]"
    count = len(segs)
    if end_still:
        if size is None:
            raise ValueError("an end still needs the take's size")
        (_, secs), (w, h) = end_still, size
        still = len(plate_texts(shown)) + 2
        parts.append(f"[{still}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,"
                     f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x1a1a1a,setsar=1,fps=60,"
                     f"trim=duration={secs:g},setpts=PTS-STARTPTS[vS]")
        joined += "[vS]"
        if audio:
            parts.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={secs:g},asetpts=PTS-STARTPTS[aS]")
            joined += "[aS]"
        count += 1
    out = "[vc][a]" if audio else "[vc]"
    parts.append(f"{joined}concat=n={count}:v=1:a={1 if audio else 0}{out}")

    index = {text: i + 1 for i, text in enumerate(plate_texts(shown))}
    last = "vc"
    for i, (text, start, end) in enumerate(shown):
        parts.append(f"[{last}][{index[text]}:v]overlay=x=(W-w)/2:y=H-h-96:enable='between(t,{start:.3f},{end:.3f})'[o{i}]")
        last = f"o{i}"
    parts.append(f"[{last}][{len(index) + 1}:v]overlay=x=80:y=H-h-80[mk]")
    parts.append("[mk]scale=trunc(iw/4)*2:trunc(ih/4)*2:flags=lanczos,fps=60,format=yuv420p[v]")
    return ";".join(parts)


def duration(video: pathlib.Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
                         capture_output=True, text=True, check=True)
    return float(out.stdout)


def frame_size(video: pathlib.Path) -> tuple[int, int]:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                          "-of", "csv=p=0:s=x", video], capture_output=True, text=True, check=True)
    w, h = out.stdout.strip().split("x")
    return int(w), int(h)


def edit(raw, take: dict | None = None, *, plate: str = PLATE, speed: float = 6, title: str,
         description: str, poster_at: float | None = None, end_still: tuple | None = None,
         bin_dir: pathlib.Path | str = BIN) -> pathlib.Path:
    """Cuts `raw` (a .mov) by its take (default: the `.json` beside it) into
    `<raw>-edit.mp4` and `<raw>-poster.jpg`. `poster_at` is a time in the
    take; by default 4 s past the last chapter's start. `end_still` is
    (png path, seconds): the image, scaled to the take's frame and letterboxed
    on #1a1a1a, held after the last frame with the mark over it."""
    raw = pathlib.Path(raw)
    bin_dir = pathlib.Path(bin_dir)
    if take is None:
        take = json.loads(raw.with_suffix(".json").read_text())
    waits = sorted((float(a), float(b), label) for a, b, label in take.get("waits", []))
    captions = [(float(t), c, float(d)) for t, c, d in take.get("captions", [])]
    audio = bool(take.get("audio", True))
    meta = take.get("meta", {})
    date = meta.get("date") or datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    out = raw.with_name(raw.stem + "-edit.mp4")

    shown = plates(waits, captions, speed)
    labels = bin_dir / "labels"
    labels.mkdir(parents=True, exist_ok=True)
    inputs = []
    for i, text in enumerate(plate_texts(shown)):
        png = labels / f"{i}.png"
        # At the take's 2x: 52 px high in the edit, 48 px off the bottom.
        subprocess.run([bin_dir / "label", text, png, "104", plate], check=True)
        inputs += ["-i", png]
    mark = labels / "mark.png"
    # 154 px at the take's 2x: 77 px high in the edit, 40 px in from the corner.
    subprocess.run([bin_dir / "label", MARK[0], mark, "154", "-", MARK[1], MARK[2]], check=True)
    inputs += ["-i", mark]
    if end_still:
        inputs += ["-loop", "1", "-framerate", "60", "-t", f"{end_still[1]:g}", "-i", end_still[0]]
    graph = filter_graph(waits, speed, audio, shown, end_still, frame_size(raw) if end_still else None)

    length = duration(raw) - removed(waits, speed) + (end_still[1] if end_still else 0)
    marks = chapter_marks(waits, take.get("chapters", []), speed)
    chapter_args = []
    if marks:
        chapter_file = bin_dir / "chapters.txt"
        chapter_file.write_text(chapters_text(marks, length))
        idx = len(plate_texts(shown)) + 2 + (1 if end_still else 0)
        inputs += ["-i", chapter_file]
        chapter_args = ["-map_metadata", str(idx), "-map_chapters", str(idx)]

    tags = {
        "title": title,
        "artist": "preset.nz",
        "copyright": f"© {date[:4]} preset.nz",
        "date": date[:10],
        "creation_time": date,
        "description": description,
        "comment": f"Recorded by just demo at {meta.get('commit', 'unknown')}.",
    }
    audio_args = (["-map", "[a]", "-metadata:s:a", "handler_name=Audio", "-metadata:s:a", "language=zxx",
                   "-c:a", "aac", "-b:a", "128k"] if audio else ["-an"])
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", raw, *inputs,
         "-filter_complex", graph, "-map", "[v]", *chapter_args,
         *[x for k, val in tags.items() for x in ("-metadata", f"{k}={val}")],
         "-metadata:s:v", "handler_name=Video", *audio_args,
         "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high",
         "-movflags", "+faststart", out],
        check=True,
    )

    poster = raw.with_name(raw.stem + "-poster.jpg")
    if poster_at is not None:
        when = at(waits, speed, poster_at)
    elif marks:
        when = marks[-1][0] + 4
    else:
        when = length / 2
    when = max(0.0, min(when, length - 0.1))
    subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-ss", f"{when:.2f}", "-i", out,
                    "-frames:v", "1", "-q:v", "3", poster], check=True)
    print(f"{raw}\n{out} ({out.stat().st_size / 1e6:.1f} MB)\n{poster}")
    if audio:
        quiet(out)
    return out


def quiet(video: pathlib.Path) -> None:
    """Says where the take is silent for 4 s or more, so a take that lost
    its sound is caught before anyone watches it."""
    log = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", video, "-vn", "-af", "silencedetect=n=-60dB:d=4", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    gaps = [line.split("] ")[1] for line in log.splitlines() if "silence_start" in line or "silence_end" in line]
    print("silent: " + ("; ".join(gaps) if gaps else "nowhere"))


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Recut a take from its .json.")
    ap.add_argument("take", type=pathlib.Path, help="the raw .mov; its .json sits beside it")
    ap.add_argument("--plate", default=PLATE, help="plate colour, hex (default %(default)s)")
    ap.add_argument("--speed", type=float, default=6)
    ap.add_argument("--title")
    ap.add_argument("--description")
    ap.add_argument("--end-still", type=pathlib.Path, help="a PNG held after the last frame")
    ap.add_argument("--end-seconds", type=float, default=3, help="how long the still is held (default %(default)s)")
    ap.add_argument("--poster-at", type=float, help="a time in the take, in seconds")
    a = ap.parse_args(argv)
    meta = json.loads(a.take.with_suffix(".json").read_text()).get("meta", {})
    product = meta.get("product", a.take.stem)
    edit(a.take, plate=a.plate, speed=a.speed, title=a.title or f"{product}: a demo",
         description=a.description or meta.get("description", f"{product} {meta.get('version', '')}".strip()),
         poster_at=a.poster_at,
         end_still=(str(a.end_still), a.end_seconds) if a.end_still else None)


if __name__ == "__main__":
    sys.exit(main())
