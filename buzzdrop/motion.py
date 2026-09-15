"""Image motion -> drive signals -> display telemetry.

Nothing here reads a sensor. Speed and heading are *estimates from how the
picture moves*, which mixes robot motion with camera motion.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import cv2
import numpy as np

from .order import Order

FLOW_SIZE = (160, 90)


@dataclass
class Motion:
    fps: float
    left: np.ndarray    # normalised motion energy, left half of frame
    right: np.ndarray   # normalised motion energy, right half
    turn: np.ndarray    # signed mean horizontal flow, -1..1
    energy: np.ndarray  # raw mean flow magnitude (px/frame at FLOW_SIZE)

    @property
    def n(self) -> int:
        return len(self.energy)


def _smooth(x: np.ndarray, k: int) -> np.ndarray:
    if k <= 1 or len(x) < k:
        return x
    pad = k // 2
    xp = np.pad(x, pad, mode="edge")
    return np.convolve(xp, np.ones(k) / k, mode="valid")[: len(x)]


def analyze(frames: Iterable[np.ndarray], fps: float, smooth: int = 9) -> Motion:
    rows, prev = [], None
    for f in frames:
        g = cv2.cvtColor(cv2.resize(f, FLOW_SIZE), cv2.COLOR_BGR2GRAY)
        if prev is None:
            rows.append((0.0, 0.0, 0.0, 0.0))
        else:
            fl = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 2, 9, 2, 5, 1.1, 0)
            mag = np.linalg.norm(fl, axis=2)
            half = FLOW_SIZE[0] // 2
            rows.append((mag[:, :half].mean(), mag[:, half:].mean(), fl[..., 0].mean(), mag.mean()))
        prev = g
    if not rows:
        raise ValueError("video has no frames")
    a = np.array(rows, dtype=np.float64)
    if len(a) > 1:
        a[0] = a[1]
    for c in range(4):
        a[:, c] = _smooth(a[:, c], smooth)
    lr = a[:, :2] / (np.percentile(a[:, :2], 95) + 1e-6)
    turn = a[:, 2] / (np.abs(a[:, 2]).max() + 1e-6)
    return Motion(fps=fps, left=np.clip(lr[:, 0], 0, 1.5), right=np.clip(lr[:, 1], 0, 1.5),
                  turn=np.clip(turn, -1, 1), energy=a[:, 3])


@dataclass
class Telemetry:
    speed: np.ndarray
    heading: np.ndarray
    remaining: np.ndarray
    progress: np.ndarray
    eta_s: np.ndarray
    en_route_s: np.ndarray
    battery: np.ndarray
    arriving: np.ndarray


def telemetry(m: Motion, order: Order) -> Telemetry:
    t = np.arange(m.n) / m.fps
    e = m.energy / (m.energy.max() + 1e-6)
    speed = order.speed_min + (order.speed_max - order.speed_min) * e
    heading = (order.heading_start + np.cumsum(m.turn) * 2.2) % 360
    travelled = np.cumsum(speed) / m.fps
    remaining = np.clip(order.remaining_m - travelled, 0, None)
    progress = 1 - remaining / order.route_length_m
    eta = remaining / np.maximum(speed, 0.15)
    return Telemetry(
        speed=speed, heading=heading, remaining=remaining, progress=progress, eta_s=eta,
        en_route_s=order.en_route_start_s + t,
        battery=np.clip(order.battery_start - t * order.battery_drain_per_s, 0, 100),
        arriving=t > (t[-1] - order.arriving_last_s),
    )
