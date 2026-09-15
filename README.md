# buzzdrop

**one fly. one order. zero neurons wired.**

Turn raw robot footage into a fly-courier delivery feed: a live-looking neural panel,
an order card with a countdown, and a REC strip — all driven by how the picture actually moves.

![buzzdrop demo](docs/demo.gif)

```
buzzdrop render robot.mp4
```

---

## What's real, what's not

Robot videos with a glowing brain in the corner are everywhere right now. Most of them
don't say what the brain is actually doing. This one does.

| On screen | Where it comes from | Real? |
|---|---|---|
| Neural flashes follow the robot | Optical flow of the frame drives spike rates per region | **Computed** from the video |
| Speed, heading, metres remaining, ETA | Derived from image motion, scaled to your `speed_min`/`speed_max` | **Estimated** — camera motion counts too |
| Fly-shaped nervous system | Hand-drawn procedural blobs (optic lobes, central brain, VNC) | **Stylised art**, not a connectome |
| Order ID, route, parcel, fee, stats | Your `order.toml` | **Display data you choose** |
| Robot controlled by a fly brain | — | **No.** Nothing here talks to the robot |

If you post a buzzdrop render, call it a concept or visualization. That's the whole point.

## Install

Needs Python 3.11+ and `ffmpeg` on your PATH.

```bash
# ffmpeg
winget install ffmpeg          # Windows
brew install ffmpeg            # macOS
sudo apt install ffmpeg        # Debian/Ubuntu

git clone https://github.com/Gipppp121/buzzdrop
cd buzzdrop
pip install -e .
```

## Use

```bash
buzzdrop probe robot.mp4                 # size, fps, how much motion, what the HUD will show
buzzdrop init order.toml                 # write an editable order card
buzzdrop render robot.mp4 --order order.toml -o delivery.mp4
```

Options for `render`:

| Flag | Does |
|---|---|
| `-o, --output` | output path (default `<input>_buzzdrop.mp4`) |
| `--order FILE` | order card TOML |
| `--seed N` | different nervous-system layout and spike pattern |
| `--no-neural` / `--no-order` / `--no-strip` | hide a panel |
| `--telemetry FILE.csv` | export per-frame motion + estimates |
| `--crf`, `--preset` | x264 quality / speed |

Works on landscape and vertical (9:16) clips; the HUD scales with the shorter side. Audio is kept.

## Order card

```toml
[order]
unit = "BZ-7"
order_id = "#D-04817"
pickup = "CAFE / BLOCK A"
dropoff = "ROOM 214 / FLOOR 2"
parcel = "1x COFFEE  0.35 KG"
route_length_m = 38.0
remaining_m = 9.8       # metres left when the clip starts
speed_min = 0.18        # m/s shown when the frame is still
speed_max = 0.73        # m/s shown at peak motion
arriving_last_s = 1.6   # EN ROUTE -> ARRIVING near the end
```

Full list in [`examples/order.toml`](examples/order.toml). Unknown keys are rejected, so typos don't silently do nothing.

## How it works

```
video ──► pass 1: Farneback optical flow (160×90)
            ├─ left / right motion energy
            ├─ signed horizontal flow  → turn
            └─ mean magnitude          → speed estimate
                     │
                     ├──► telemetry: heading, metres remaining, ETA, battery
                     └──► nervous system drive
                            optic L/R ─(4 fr)─► central ─(5 fr)─► VNC L/R ─(4 fr)─► abdominal
                            spike p = 0.004 + 0.05 · drive   brightness decays ×0.78/frame
video ──► pass 2: draw panels (PIL + glow) ──► pipe raw frames ──► ffmpeg x264 (+ original audio)
```

Horizontal flow to one side feeds one VNC column, flow to the other side feeds the other, so the L/R bars swing as the shot turns.

```
buzzdrop/
  motion.py   optical flow → drive signals → telemetry
  nervous.py  procedural fly-shaped point cloud + toy spiking rule
  hud.py      strict monochrome panels, scaled from a 720p design
  render.py   two-pass pipeline, ffmpeg writer, CSV export
  order.py    order card dataclass + TOML loader
  cli.py      render / probe / init
```

## Tests

```bash
python -m unittest discover -s tests -v
```

Covers config validation, motion on synthetic clips, deterministic layouts, panel sizes,
and a full CLI render (skipped if ffmpeg is missing).

## Roadmap

- [ ] Final DELIVERED freeze-frame with a hold duration
- [ ] Track the robot itself instead of whole-frame motion
- [ ] Mini route map panel
- [ ] Colour themes
- [ ] Read real telemetry (serial / UDP) when a robot actually has some

## License

MIT
