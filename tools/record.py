"""Record the scripted autopilot run to an MP4, frame by frame.

The game has a capture mode (index.html?capture=1). In that mode nothing runs
on its own clock: every call to window.__cap.step(n) advances the world by
n frames of 1/30 s and renders the last one. That makes the recording
deterministic and independent of how fast the machine is.

    pip install playwright && playwright install chromium
    python tools/record.py --seconds 27 -o gameplay.mp4

Options:
    --pr 0.75        3D render scale (HUD stays sharp at full resolution)
    --workers 2      split the frame range across browser processes
    --clean          hide the HUD
    --page FILE      page to record (default index.html)
"""
import argparse
import asyncio
import base64
import pathlib
import shutil
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
FPS = 30
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


async def worker(url, start, end, frames_dir, w, h, tag):
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=ARGS)
        page = await browser.new_page(viewport={"width": w, "height": h})
        await page.goto(url)
        await page.wait_for_function("!!(window.__cap && window.__cap.step)", polling=250, timeout=60000)
        cdp = await page.context.new_cdp_session(page)
        if start:
            await page.evaluate(f"window.__cap.step({start})")
        t0 = time.time()
        for f in range(start, end):
            await page.evaluate("window.__cap.step(1)")
            shot = await cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 92})
            (frames_dir / f"{f:05d}.jpg").write_bytes(base64.b64decode(shot["data"]))
            if (f - start) % 60 == 0:
                print(f"[{tag}] frame {f}/{end}  {time.time() - t0:.0f}s", flush=True)
        await browser.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default="gameplay.mp4")
    ap.add_argument("--seconds", type=float, default=27)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--pr", type=float, default=0.75)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--clean", action="store_true")
    ap.add_argument("--page", default=str(ROOT / "index.html"))
    ap.add_argument("--part", nargs=2, type=int, help=argparse.SUPPRESS)
    ap.add_argument("--frames", default=str(ROOT / "frames"), help=argparse.SUPPRESS)
    a = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")
    url = pathlib.Path(a.page).resolve().as_uri() + f"?capture=1&pr={a.pr}" + ("&clean=1" if a.clean else "")
    frames = pathlib.Path(a.frames)
    total = int(a.seconds * FPS)

    if a.part:  # child process
        asyncio.run(worker(url, a.part[0], a.part[1], frames, a.width, a.height, f"{a.part[0]}"))
        return

    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir(parents=True)
    n = max(1, a.workers)
    cuts = [round(total * i / n) for i in range(n + 1)]
    procs = [
        subprocess.Popen([sys.executable, __file__, "--part", str(cuts[i]), str(cuts[i + 1]),
                          "--frames", str(frames), "--page", a.page, "--pr", str(a.pr),
                          "--width", str(a.width), "--height", str(a.height)] + (["--clean"] if a.clean else []))
        for i in range(n)
    ]
    if any(p.wait() for p in procs):
        sys.exit("a capture worker failed")

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(frames / "%05d.jpg"),
                    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", a.output], check=True)
    print(f"wrote {a.output}  ({total} frames)")


if __name__ == "__main__":
    main()
