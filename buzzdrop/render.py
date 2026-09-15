"""Two-pass pipeline: analyse motion, then draw the HUD and pipe frames to ffmpeg."""
from __future__ import annotations

import csv
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import cv2
import numpy as np

from . import hud
from .motion import Motion, Telemetry, analyze, telemetry
from .nervous import NervousSystem
from .order import Order


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: float
    frames: int


def probe(path: str | Path) -> VideoInfo:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"cannot open video: {path}")
    info = VideoInfo(int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                     cap.get(cv2.CAP_PROP_FPS) or 30.0, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
    cap.release()
    return info


def iter_frames(path: str | Path) -> Iterator[np.ndarray]:
    cap = cv2.VideoCapture(str(path))
    try:
        while True:
            ok, f = cap.read()
            if not ok:
                return
            yield f
    finally:
        cap.release()


def write_telemetry_csv(path: str | Path, m: Motion, tel: Telemetry) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh)
        wr.writerow(["frame", "time_s", "motion_left", "motion_right", "turn",
                     "speed_mps_est", "heading_deg_est", "remaining_m", "eta_s", "battery"])
        for i in range(m.n):
            wr.writerow([i, f"{i / m.fps:.3f}", f"{m.left[i]:.4f}", f"{m.right[i]:.4f}", f"{m.turn[i]:.4f}",
                         f"{tel.speed[i]:.3f}", f"{tel.heading[i]:.1f}", f"{tel.remaining[i]:.2f}",
                         f"{tel.eta_s[i]:.1f}", f"{tel.battery[i]:.1f}"])


def _progress(i: int, n: int, label: str) -> None:
    if sys.stderr.isatty() and (i % 10 == 0 or i == n):
        pct = 100 * i / max(1, n)
        sys.stderr.write(f"\r{label} {i}/{n} ({pct:4.0f}%)")
        if i == n:
            sys.stderr.write("\n")
        sys.stderr.flush()


def render(src: str | Path, out: str | Path, order: Order, *, seed: int = 7,
           neural: bool = True, card: bool = True, bar: bool = True,
           crf: int = 18, preset: str = "medium", telemetry_csv: str | Path | None = None) -> VideoInfo:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("ffmpeg not found on PATH, install it first (see README)")
    info = probe(src)

    m = analyze(iter_frames(src), info.fps)
    tel = telemetry(m, order)
    if telemetry_csv:
        write_telemetry_csv(telemetry_csv, m, tel)

    S = hud.Scale(min(info.width, info.height) / 720)
    margin = S(24)
    ns = NervousSystem(seed=seed)
    npanel = hud.NeuralPanel(ns, S)
    ow = S(hud.ORDER_SIZE[0])
    if neural and card and npanel.w + ow + 3 * margin > info.width:
        raise ValueError("video too narrow for both panels; use --no-neural or --no-order")

    cmd = [ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
           "-s", f"{info.width}x{info.height}", "-r", f"{info.fps}", "-i", "-",
           "-i", str(src), "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", str(crf),
           "-preset", preset, "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for t, frame in enumerate(iter_frames(src)):
            if t >= m.n:
                break
            drive = ns.drive(m, t)
            spikes = ns.step(drive)
            if neural:
                hud.composite(frame, npanel.draw(spikes, drive), margin, margin)
            if card:
                hud.composite(frame, hud.order_panel(order, tel, t, S), info.width - ow - margin, margin)
            if bar:
                sw = info.width - 2 * margin
                hud.composite(frame, hud.strip(order, tel, t, info.fps, sw, S),
                              margin, info.height - margin - S(22), alpha=0.85)
            proc.stdin.write(frame.tobytes())
            _progress(t + 1, m.n, "render")
    finally:
        proc.stdin.close()
        code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg exited with code {code}")
    return info
