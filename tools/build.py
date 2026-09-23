"""Bundle src/ into a single playable index.html.

    python tools/build.py            write index.html
    python tools/build.py --check    fail if index.html is out of date
    python tools/build.py --three PATH/three.min.js -o local.html
                                     use a local three.js (offline recording)
"""
import argparse
import base64
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CDN_THREE = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
FONTS = [
    ("Syne", 800, "syne-latin-800-normal.woff2"),
    ("Syne", 700, "syne-latin-700-normal.woff2"),
    ("JetBrains Mono", 400, "jetbrains-mono-latin-400-normal.woff2"),
    ("JetBrains Mono", 700, "jetbrains-mono-latin-700-normal.woff2"),
]


def font_css():
    out = []
    for family, weight, name in FONTS:
        data = base64.b64encode((ROOT / "tools" / "fonts" / name).read_bytes()).decode()
        out.append(
            "@font-face{font-family:'%s';font-weight:%d;font-style:normal;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2')}" % (family, weight, data)
        )
    return "\n".join(out)


def build(three_src):
    shell = (ROOT / "src" / "shell.html").read_text(encoding="utf-8")
    game = (ROOT / "src" / "game.js").read_text(encoding="utf-8")
    for marker in ("/*FONTS*/", "<!--THREE-->", "/*GAME*/"):
        if marker not in shell:
            sys.exit(f"src/shell.html is missing the {marker} marker")
    body = (
        shell.replace("/*FONTS*/", font_css())
        .replace("<!--THREE-->", f'<script src="{three_src}"></script>')
        .replace("/*GAME*/", game)
    )
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        "</head>\n<body>\n" + body + "\n</body>\n</html>\n"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=str(ROOT / "index.html"))
    ap.add_argument("--three", default=CDN_THREE, help="three.js URL or local path")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    html = build(a.three)
    out = pathlib.Path(a.output)
    if a.check:
        if not out.exists() or out.read_text(encoding="utf-8") != html:
            sys.exit("index.html is out of date, run: python tools/build.py")
        print("index.html is up to date")
        return
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.name} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
