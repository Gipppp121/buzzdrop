"""A procedural, fly-shaped point cloud with a toy spiking rule.

This is NOT a connectome and NOT a brain simulation. Geometry is hand-drawn
blobs; "spikes" are random events whose rate follows image motion.
"""
from __future__ import annotations

import numpy as np

from .motion import Motion

REGIONS = ("optic_l", "optic_r", "central", "vnc_l", "vnc_r", "abdominal")
DELAY = np.array([0, 0, 4, 9, 9, 13])  # frames: optic -> central -> vnc -> abdominal

# (count, cx, cy, rx, ry, region, crescent side)
LAYOUT = [
    (800, .19, .30, .13, .17, 0, -1), (800, .81, .30, .13, .17, 1, 1),
    (1200, .50, .29, .20, .14, 2, 0), (300, .50, .47, .09, .06, 2, 0),
    (230, .43, .60, .07, .05, 3, 0), (230, .57, .60, .07, .05, 4, 0),
    (230, .43, .71, .07, .05, 3, 0), (230, .57, .71, .07, .05, 4, 0),
    (230, .43, .82, .07, .05, 3, 0), (230, .57, .82, .07, .05, 4, 0),
    (200, .50, .91, .05, .05, 5, 0),
]


def _blob(rng, n, cx, cy, rx, ry, crescent):
    out = np.empty((0, 2))
    while len(out) < n:
        xy = rng.uniform(-1, 1, (n * 3, 2))
        keep = (xy ** 2).sum(1) <= 1
        if crescent:
            keep &= (xy[:, 0] * crescent + 0.55) ** 2 + xy[:, 1] ** 2 >= 0.45
        out = np.vstack([out, xy[keep]])
    out = out[:n]
    return np.column_stack([cx + out[:, 0] * rx, cy + out[:, 1] * ry])


class NervousSystem:
    def __init__(self, seed: int = 7, density: float = 1.0, decay: float = 0.78):
        self.rng = np.random.default_rng(seed)
        pts, reg = [], []
        for n, cx, cy, rx, ry, r, cres in LAYOUT:
            k = max(1, int(n * density))
            pts.append(_blob(self.rng, k, cx, cy, rx, ry, cres))
            reg.append(np.full(k, r))
        self.points = np.vstack(pts)            # normalised 0..1
        self.region = np.concatenate(reg)
        self.brightness = np.zeros(len(self.points), np.float32)
        self.decay = decay

    def __len__(self) -> int:
        return len(self.points)

    @staticmethod
    def drive(m: Motion, t: int) -> np.ndarray:
        idx = np.clip(t - DELAY, 0, m.n - 1)
        l, r, turn = m.left[idx], m.right[idx], m.turn[idx]
        base = 0.25 * (l + r)
        return np.array([l[0], r[1], 0.5 * (l[2] + r[2]),
                         base[3] + max(0.0, turn[3]), base[4] + max(0.0, -turn[4]),
                         0.4 * (l[5] + r[5])], dtype=np.float32)

    def step(self, drive: np.ndarray) -> np.ndarray:
        p = 0.004 + 0.05 * np.clip(drive[self.region], 0, 2)
        spikes = self.rng.random(len(self)) < p
        self.brightness *= self.decay
        self.brightness[spikes] = 1.0
        return spikes
