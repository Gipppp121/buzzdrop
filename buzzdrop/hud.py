"""Strict monochrome HUD panels. All sizes are designed at 720p and scaled."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .motion import Telemetry
from .nervous import NervousSystem
from .order import Order

BG = (10, 10, 10)
LINE = (58, 58, 58)
FAINT = (32, 32, 32)
DIM = (130, 130, 130)
TXT = (235, 235, 235)
ACC = (255, 140, 0)

_FONT_CANDIDATES = {
    False: ["DejaVuSansMono.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            "C:/Windows/Fonts/consola.ttf", "/System/Library/Fonts/Menlo.ttc"],
    True: ["DejaVuSansMono-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
           "C:/Windows/Fonts/consolab.ttf", "/System/Library/Fonts/Menlo.ttc"],
}


@lru_cache(maxsize=None)
def font(size: int, bold: bool = False):
    for cand in _FONT_CANDIDATES[bold]:
        try:
            return ImageFont.truetype(cand, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def clock(seconds: float) -> str:
    s = max(0, int(seconds))
    return f"{s // 60:02d}:{s % 60:02d}"


def timecode(frame: int, fps: float) -> str:
    sec = frame / fps
    return f"{int(sec // 60):02d}:{int(sec % 60):02d}:{int(frame % max(1, round(fps))):02d}"


class Scale:
    def __init__(self, s: float):
        self.s = s

    def __call__(self, v: float) -> int:
        return int(round(v * self.s))

    def f(self, size: int, bold: bool = False):
        return font(max(8, self(size)), bold)


def _corners(dr, w, h, S):
    L = S(8)
    for x, y, sx, sy in [(0, 0, 1, 1), (w - 1, 0, -1, 1), (0, h - 1, 1, -1), (w - 1, h - 1, -1, -1)]:
        dr.line((x, y, x + sx * L, y), fill=TXT)
        dr.line((x, y, x, y + sy * L), fill=TXT)


def _frame(dr, w, h, S, title, right):
    dr.rectangle((0, 0, w - 1, h - 1), outline=LINE)
    _corners(dr, w, h, S)
    dr.text((S(10), S(9)), title, font=S.f(11, True), fill=TXT)
    dr.text((w - S(10), S(9)), right, font=S.f(11, True), fill=TXT, anchor="ra")
    dr.line((S(10), S(28), w - S(10), S(28)), fill=LINE)


# ---------------------------------------------------------------- neural panel
NEURAL_SIZE = (270, 480)
BRAIN_BOX = (250, 330)


class NeuralPanel:
    def __init__(self, ns: NervousSystem, S: Scale, raster_rows: int = 24, raster_len: int = 100):
        self.ns, self.S = ns, S
        self.w, self.h = S(NEURAL_SIZE[0]), S(NEURAL_SIZE[1])
        bw, bh = S(BRAIN_BOX[0]), S(BRAIN_BOX[1])
        self.xi = np.clip((ns.points[:, 0] * bw + S(10)).astype(int), 0, self.w - 1)
        self.yi = np.clip((ns.points[:, 1] * bh + S(44)).astype(int), 0, self.h - 1)
        self.raster_idx = ns.rng.choice(len(ns), raster_rows, replace=False)
        self.raster = np.zeros((raster_rows, raster_len), np.float32)

    def draw(self, spikes: np.ndarray, drive: np.ndarray) -> np.ndarray:
        S, w, h, ns = self.S, self.w, self.h, self.ns
        self.raster = np.roll(self.raster, -1, 1)
        self.raster[:, -1] = spikes[self.raster_idx]

        img = np.full((h, w), BG[0], np.float32)
        np.add.at(img, (self.yi, self.xi), 42.0)
        glow = np.zeros((h, w), np.float32)
        act = ns.brightness > 0.05
        np.add.at(glow, (self.yi[act], self.xi[act]), ns.brightness[act])
        img += cv2.GaussianBlur(glow, (0, 0), 2.2 * S.s) * 520 + cv2.GaussianBlur(glow, (0, 0), 0.8 * S.s) * 300

        ry0 = S(BRAIN_BOX[1] + 70)
        rows, length = self.raster.shape
        for k in range(rows):
            on = np.nonzero(self.raster[k] > 0)[0]
            y = min(h - 1, ry0 + k * S(2))
            img[y, np.clip((S(12) + on * (w - S(24)) / length).astype(int), 0, w - 1)] = 200

        rgb = np.repeat(np.clip(img, 0, 255).astype(np.uint8)[..., None], 3, axis=2)
        pil = Image.fromarray(rgb)
        dr = ImageDraw.Draw(pil)
        _frame(dr, w, h, S, "NEURAL ACTIVITY", "VIS")
        yb = S(BRAIN_BOX[1] + 48)
        dr.line((S(10), yb, w - S(10), yb), fill=LINE)
        dr.text((S(10), yb + S(6)), "RASTER", font=S.f(10), fill=DIM)
        dr.text((w - S(10), yb + S(6)), f"{int(spikes.sum()):03d} SPK", font=S.f(10), fill=TXT, anchor="ra")
        by = h - S(22)
        bars = (("L", np.clip(drive[3], 0, 1.6) / 1.6), ("R", np.clip(drive[4], 0, 1.6) / 1.6))
        bw = (w - S(20)) // 2 - S(6)
        for j, (lab, v) in enumerate(bars):
            x = S(10) + j * (bw + S(12))
            dr.text((x, by - S(1)), lab, font=S.f(10), fill=DIM)
            dr.rectangle((x + S(12), by + S(1), x + bw, by + S(7)), outline=LINE)
            dr.rectangle((x + S(13), by + S(2), x + S(13) + int((bw - S(14)) * float(v)), by + S(6)), fill=TXT)
        return np.asarray(pil)


# ---------------------------------------------------------------- order panel
ORDER_SIZE = (300, 366)


def order_panel(order: Order, tel: Telemetry, t: int, S: Scale) -> np.ndarray:
    w, h = S(ORDER_SIZE[0]), S(ORDER_SIZE[1])
    pil = Image.new("RGB", (w, h), BG)
    dr = ImageDraw.Draw(pil)
    _frame(dr, w, h, S, f"{order.unit} // DELIVERY", order.order_id)

    stages = list(order.stages)
    if tel.arriving[t]:
        stages[2] = "ARRIVING"
    active = 2
    xs = [S(40) + i * (w - S(80)) / 3 for i in range(4)]
    y0 = S(44)
    dr.line((xs[0], y0, xs[3], y0), fill=LINE)
    dr.line((xs[0], y0, xs[2], y0), fill=TXT)
    blink = (t // 12) % 2 == 0
    for i, x in enumerate(xs):
        r = S(4)
        if i < active:
            dr.rectangle((x - r, y0 - r, x + r, y0 + r), fill=TXT)
        elif i == active:
            r = S(5)
            dr.rectangle((x - r, y0 - r, x + r, y0 + r), fill=ACC if blink else BG, outline=ACC)
        else:
            dr.rectangle((x - r, y0 - r, x + r, y0 + r), fill=BG, outline=DIM)
        dr.text((x, S(55)), stages[i], font=S.f(10), fill=TXT if i <= active else DIM, anchor="ma")

    rows = [("FROM", order.pickup), ("TO", order.dropoff), ("PARCEL", order.parcel),
            ("PICKED UP", order.picked_up_at), ("EN ROUTE", clock(tel.en_route_s[t])),
            ("REMAINING", f"{tel.remaining[t]:.1f} M"), ("SPEED", f"{tel.speed[t]:.2f} M/S"),
            ("ETA", clock(tel.eta_s[t])), ("FEE", order.fee)]
    y = S(74)
    for i, (k, v) in enumerate(rows):
        dr.line((S(10), y, w - S(10), y), fill=FAINT if i else LINE)
        dr.text((S(10), y + S(5)), k, font=S.f(11), fill=DIM)
        hot = k in ("REMAINING", "ETA")
        dr.text((w - S(10), y + S(5)), v, font=S.f(11, hot), fill=TXT, anchor="ra")
        y += S(22)
    dr.line((S(10), y, w - S(10), y), fill=LINE)

    prog = float(np.clip(tel.progress[t], 0, 1))
    dr.text((S(10), y + S(8)), "A", font=S.f(10), fill=TXT)
    dr.text((w - S(10), y + S(8)), "B", font=S.f(10), fill=TXT, anchor="ra")
    dr.text((w / 2, y + S(8)), f"{prog * 100:.0f}% OF {order.route_length_m:.0f} M", font=S.f(10), fill=DIM, anchor="ma")
    bx0, bx1 = S(22), w - S(22)
    dr.rectangle((bx0, y + S(26), bx1, y + S(31)), outline=LINE)
    px = bx0 + int((bx1 - bx0) * prog)
    dr.rectangle((bx0 + 1, y + S(27), px, y + S(30)), fill=ACC)
    dr.polygon([(px, y + S(22)), (px - S(4), y + S(18)), (px + S(4), y + S(18))], fill=TXT)

    y2 = y + S(42)
    dr.line((S(10), y2, w - S(10), y2), fill=LINE)
    stats = [("TODAY", f"{order.today_orders} ORDERS"), ("ON TIME", order.on_time), ("BATTERY", f"{tel.battery[t]:.0f} %")]
    for j, (k, v) in enumerate(stats):
        x = S(10) + j * (w - S(20)) / 3
        dr.text((x, y2 + S(7)), k, font=S.f(10), fill=DIM)
        dr.text((x, y2 + S(20)), v, font=S.f(11, True), fill=TXT)
    return np.asarray(pil)


# ---------------------------------------------------------------- bottom strip
def strip(order: Order, tel: Telemetry, t: int, fps: float, width: int, S: Scale) -> np.ndarray:
    h = S(22)
    pil = Image.new("RGB", (width, h), BG)
    dr = ImageDraw.Draw(pil)
    dr.rectangle((0, 0, width - 1, h - 1), outline=LINE)
    f = S.f(10)
    dr.text((S(10), S(5)), f"REC  {timecode(t, fps)}", font=f, fill=TXT)
    dr.text((S(110), S(5)), f"FRM {t:04d}", font=f, fill=DIM)
    dr.text((width / 2, S(5)), f"{order.unit} // DELIVERY {order.order_id}", font=f, fill=DIM, anchor="ma")
    dr.text((width - S(10), S(5)), f"HDG {tel.heading[t]:05.1f}°   {tel.speed[t]:.2f} M/S", font=f, fill=TXT, anchor="ra")
    return np.asarray(pil)


def composite(frame_bgr: np.ndarray, panel_rgb: np.ndarray, x: int, y: int, alpha: float = 0.9) -> None:
    h, w = panel_rgb.shape[:2]
    H, W = frame_bgr.shape[:2]
    x2, y2 = min(W, x + w), min(H, y + h)
    if x2 <= x or y2 <= y:
        return
    roi = frame_bgr[y:y2, x:x2].astype(np.float32)
    pan = panel_rgb[: y2 - y, : x2 - x, ::-1].astype(np.float32)
    frame_bgr[y:y2, x:x2] = (roi * (1 - alpha) + pan * alpha).astype(np.uint8)
