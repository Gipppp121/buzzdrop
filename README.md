# buzzdrop v0.1

![buzzdrop](assets/banner.png)

![python](https://img.shields.io/badge/python-%E2%89%A53.11-9AA694?style=flat-square&labelColor=0A0D0B)
![ffmpeg](https://img.shields.io/badge/ffmpeg-required-9AA694?style=flat-square&labelColor=0A0D0B)
![unit](https://img.shields.io/badge/unit-BZ--7-FF8C00?style=flat-square&labelColor=0A0D0B)
![robot control](https://img.shields.io/badge/robot%20control-none-FF6B5E?style=flat-square&labelColor=0A0D0B)
![tests](https://img.shields.io/badge/tests-12%20passing-FF8C00?style=flat-square&labelColor=0A0D0B)
![license](https://img.shields.io/badge/license-MIT-FF8C00?style=flat-square&labelColor=0A0D0B)

**Turn robot footage into a fly-courier delivery HUD.**

buzzdrop takes a clip of a robot, measures how the picture moves, and draws three things on top: a neural activity panel, a delivery order card with a live countdown, and a REC strip.

> **No brain. No sensors. No link to the robot.** buzzdrop reads video frames and writes video frames. Every number on screen comes from image motion or from your order file.

**Created by:** [@gippp69](https://x.com/gippp69)

---

## Demo

![buzzdrop demo](assets/demo.gif)

Unit BZ-7 on a real floor run. The neural panel and the speed, heading and ETA values follow the motion in the clip.

---

## What it draws

**Neural panel (left):**

- fly-shaped nervous system: optic lobes, central brain, ventral nerve cord
- flashes whose rate follows motion in the frame
- spike raster and spike counter
- L / R bars that swing with horizontal movement

**Delivery card (right):**

- order status: `ACCEPTED` → `PICKED UP` → `EN ROUTE` → `DELIVERED`
- switches to `ARRIVING` near the end of the clip
- pickup, dropoff, parcel, pickup time
- time en route, metres remaining, speed, ETA, fee
- route bar A → B, orders today, on-time rate, battery

**REC strip (bottom):**

- timecode, frame number, unit, order id, heading, speed

Works on landscape and vertical 9:16 clips. The HUD scales with the shorter side of the video. Audio is kept.

---

## Quick start

Install ffmpeg first:

```bash
winget install ffmpeg          # Windows
brew install ffmpeg            # macOS
sudo apt install ffmpeg        # Debian / Ubuntu
```

Then:

```bash
git clone https://github.com/Gipppp121/buzzdrop.git
cd buzzdrop
pip install -e .

# check a clip before rendering
buzzdrop probe robot.mp4

# write an editable order card
buzzdrop init order.toml

# render
buzzdrop render robot.mp4 --order order.toml -o delivery.mp4
```

`render` options:

```text
-o, --output FILE        output path, default <input>_buzzdrop.mp4
--order FILE             order card TOML
--seed N                 different nervous system layout and spike pattern
--no-neural              hide the neural panel
--no-order               hide the delivery card
--no-strip               hide the REC strip
--telemetry FILE.csv     export per-frame motion and estimates
--crf N, --preset NAME   x264 quality and speed
```

---

## Order card

Everything on the delivery card that is not measured comes from this file.

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
arriving_last_s = 1.6   # EN ROUTE becomes ARRIVING this close to the end
```

Full list: [`examples/order.toml`](examples/order.toml). Unknown keys are rejected, so a typo fails loudly instead of doing nothing.

---

## What is measured

```text
COMPUTED    neural flashes           optical flow drives spike rate per region
ESTIMATED   speed, heading           image motion, scaled to speed_min / speed_max
ESTIMATED   remaining, ETA           integrated from the speed estimate
STYLISED    nervous system shape     hand-drawn procedural blobs, not a connectome
DISPLAY     order, route, fee        values from order.toml
NONE        robot control            buzzdrop never talks to the robot
```

Camera movement counts as motion. If the camera pans, speed and heading change even if the robot does not.

If you post a render, label it as a concept or visualization.

---

## How it works

```text
video
  pass 1   Farneback optical flow at 160x90
           left / right motion energy
           signed horizontal flow   → turn
           mean flow magnitude      → speed estimate

  telemetry   heading, metres remaining, ETA, battery

  nervous system
           optic L/R  →(4 fr)→  central  →(5 fr)→  VNC L/R  →(4 fr)→  abdominal
           spike chance = 0.004 + 0.05 × drive
           brightness decays ×0.78 per frame

  pass 2   draw panels with PIL and glow
           pipe raw frames to ffmpeg, x264, original audio
```

```text
buzzdrop/
  motion.py    optical flow, drive signals, telemetry
  nervous.py   procedural point cloud and spike rule
  hud.py       monochrome panels, designed at 720p and scaled
  render.py    two-pass pipeline, ffmpeg writer, CSV export
  order.py     order card dataclass and TOML loader
  cli.py       render / probe / init
```

---

## Tests

```bash
python -m unittest discover -s tests -v
```

Covers config validation, motion on synthetic clips, deterministic layouts, panel sizes and a full CLI render. The render test is skipped if ffmpeg is missing.

---

## Roadmap

- [ ] `DELIVERED` freeze frame with a hold duration
- [ ] track the robot itself instead of whole-frame motion
- [ ] mini route map panel
- [ ] colour themes
- [ ] read real telemetry over serial / UDP once the robot has sensors

---

## License

MIT
