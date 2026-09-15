import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from buzzdrop import hud
from buzzdrop.cli import main
from buzzdrop.motion import analyze, telemetry
from buzzdrop.nervous import NervousSystem
from buzzdrop.order import SAMPLE, Order, load


def moving_square(n=40, w=320, h=180, dx=3):
    for i in range(n):
        f = np.full((h, w, 3), 40, np.uint8)
        x = 20 + i * dx
        cv2.rectangle(f, (x, 60), (x + 40, 100), (220, 220, 220), -1)
        cv2.circle(f, (w - 30, 30 + i), 10, (120, 120, 120), -1)
        yield f


class TestOrder(unittest.TestCase):
    def test_defaults_valid(self):
        self.assertEqual(load(None).unit, "BZ-7")

    def test_sample_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d, "o.toml"); p.write_text(SAMPLE)
            self.assertEqual(load(p), Order().validate())

    def test_unknown_key_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d, "o.toml"); p.write_text('[order]\nspeeed = 1\n')
            with self.assertRaises(ValueError):
                load(p)

    def test_bad_remaining(self):
        with self.assertRaises(ValueError):
            Order(remaining_m=99, route_length_m=10).validate()


class TestMotion(unittest.TestCase):
    def test_moving_scene_has_motion(self):
        m = analyze(moving_square(), fps=30)
        self.assertEqual(m.n, 40)
        self.assertGreater(m.energy.mean(), 0.01)
        self.assertGreater(m.turn.mean(), 0)  # square moves right

    def test_static_scene_is_quiet(self):
        frames = [np.full((90, 160, 3), 80, np.uint8)] * 20
        m = analyze(frames, fps=30)
        self.assertLess(m.energy.max(), 1e-3)

    def test_telemetry_monotonic(self):
        m = analyze(moving_square(), fps=30)
        tel = telemetry(m, Order(arriving_last_s=0.5))
        self.assertTrue(np.all(np.diff(tel.remaining) <= 1e-9))
        self.assertTrue(np.all(np.diff(tel.battery) <= 1e-9))
        self.assertTrue(tel.arriving[-1] and not tel.arriving[0])


class TestNervous(unittest.TestCase):
    def test_seeded_layout_is_deterministic(self):
        a, b = NervousSystem(seed=3), NervousSystem(seed=3)
        np.testing.assert_array_equal(a.points, b.points)
        self.assertTrue(((a.points >= 0) & (a.points <= 1)).all())

    def test_drive_raises_spike_rate(self):
        ns = NervousSystem(seed=1)
        quiet = np.mean([ns.step(np.zeros(6, np.float32)).mean() for _ in range(30)])
        busy = np.mean([ns.step(np.full(6, 1.5, np.float32)).mean() for _ in range(30)])
        self.assertGreater(busy, quiet * 5)


class TestHud(unittest.TestCase):
    def test_panels_have_expected_size(self):
        m = analyze(moving_square(), fps=30)
        tel, S = telemetry(m, Order()), hud.Scale(1.5)
        ns = NervousSystem()
        np_ = hud.NeuralPanel(ns, S)
        d = ns.drive(m, 5)
        self.assertEqual(np_.draw(ns.step(d), d).shape, (720, 405, 3))
        self.assertEqual(hud.order_panel(Order(), tel, 5, S).shape, (549, 450, 3))


@unittest.skipIf(shutil.which("ffmpeg") is None, "ffmpeg not installed")
class TestEndToEnd(unittest.TestCase):
    def test_cli_render(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d, "in.mp4")
            vw = cv2.VideoWriter(str(src), cv2.VideoWriter_fourcc(*"mp4v"), 30, (1280, 720))
            for f in moving_square(n=30, w=1280, h=720, dx=12):
                vw.write(f)
            vw.release()
            out, csv_path = Path(d, "out.mp4"), Path(d, "t.csv")
            code = main(["render", str(src), "-o", str(out), "--preset", "ultrafast", "--telemetry", str(csv_path)])
            self.assertEqual(code, 0)
            self.assertGreater(out.stat().st_size, 1000)
            self.assertEqual(len(csv_path.read_text().splitlines()), 31)
            n = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
                                "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(out)],
                               capture_output=True, text=True).stdout.strip()
            self.assertEqual(int(n), 30)

    def test_missing_input(self):
        self.assertEqual(main(["render", "nope.mp4"]), 2)


if __name__ == "__main__":
    unittest.main()
