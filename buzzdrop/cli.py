from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .order import SAMPLE, load


def _cmd_render(a) -> int:
    from .render import render
    order = load(a.order)
    out = Path(a.output or Path(a.input).with_name(Path(a.input).stem + "_buzzdrop.mp4"))
    info = render(a.input, out, order, seed=a.seed, neural=not a.no_neural, card=not a.no_order,
                  bar=not a.no_strip, crf=a.crf, preset=a.preset, telemetry_csv=a.telemetry)
    print(f"wrote {out}  ({info.width}x{info.height} @ {info.fps:.2f} fps)")
    return 0


def _cmd_probe(a) -> int:
    from .motion import analyze, telemetry
    from .render import iter_frames, probe
    info = probe(a.input)
    m = analyze(iter_frames(a.input), info.fps)
    tel = telemetry(m, load(a.order))
    print(f"size      {info.width}x{info.height}")
    print(f"fps       {info.fps:.2f}")
    print(f"frames    {m.n}  ({m.n / info.fps:.1f} s)")
    print(f"motion    mean {m.energy.mean():.3f}  peak {m.energy.max():.3f} px/frame")
    print(f"turn      left {(m.turn < -0.2).mean() * 100:.0f}%  right {(m.turn > 0.2).mean() * 100:.0f}% of frames")
    print(f"hud       speed {tel.speed.min():.2f}-{tel.speed.max():.2f} m/s, remaining "
          f"{tel.remaining[0]:.1f} -> {tel.remaining[-1]:.1f} m")
    return 0


def _cmd_init(a) -> int:
    p = Path(a.path)
    if p.exists() and not a.force:
        print(f"{p} exists (use --force to overwrite)", file=sys.stderr)
        return 1
    p.write_text(SAMPLE, encoding="utf-8")
    print(f"wrote {p}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="buzzdrop", description="Turn robot footage into a fly-courier delivery HUD.")
    ap.add_argument("--version", action="version", version=f"buzzdrop {__version__}")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render", help="render the HUD onto a video")
    r.add_argument("input")
    r.add_argument("-o", "--output")
    r.add_argument("--order", help="order card TOML (see `buzzdrop init`)")
    r.add_argument("--seed", type=int, default=7, help="nervous-system layout/spike seed")
    r.add_argument("--no-neural", action="store_true", help="hide the neural panel")
    r.add_argument("--no-order", action="store_true", help="hide the delivery card")
    r.add_argument("--no-strip", action="store_true", help="hide the bottom REC strip")
    r.add_argument("--crf", type=int, default=18)
    r.add_argument("--preset", default="medium")
    r.add_argument("--telemetry", metavar="CSV", help="also export per-frame estimates to CSV")
    r.set_defaults(func=_cmd_render)

    p = sub.add_parser("probe", help="print video info and motion summary")
    p.add_argument("input")
    p.add_argument("--order")
    p.set_defaults(func=_cmd_probe)

    i = sub.add_parser("init", help="write a sample order.toml")
    i.add_argument("path", nargs="?", default="order.toml")
    i.add_argument("--force", action="store_true")
    i.set_defaults(func=_cmd_init)
    return ap


def main(argv: list[str] | None = None) -> int:
    a = build_parser().parse_args(argv)
    try:
        return a.func(a)
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        print(f"buzzdrop: {e}", file=sys.stderr)
        return 2
