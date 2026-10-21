#!/usr/bin/env python3
"""Draws the Agent Dock helper faces: one original pixel mascot in 12 colors x 3 looks.

Standard library only. Re-run after changing COLORS or the sprites:

    python3 -I claude/mods/clean-view/tools/make_mascots.py

Writes employee-headshots/helper-<nn>.png and employee-headshots/sheet.png (a preview).
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "employee-headshots"
SCALE = 8  # 16x16 sprite -> 128x128 PNG, hard pixel edges

# Calm tones that sit with the dock's coral and gold; no rainbow.
COLORS = [
    "E8735A", "E6B45A", "5FB98A", "4FA3A5", "6C8EBF", "9C88C9",
    "D9798F", "C9A97C", "8FAE7E", "6FB3D6", "C27B4E", "A0729C",
]

# B body, S shade, E eye, W eye shine, M mouth, A accessory (the body color, lighter), . empty
BASE = [
    "................",
    "................",
    "................",
    "....BBBBBBBB....",
    "...BBBBBBBBBB...",
    "..BBBBBBBBBBBB..",
    "..BBEEBBBBEEBB..",
    "..BBEWBBBBEWBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBMMBBBBB..",
    "..BBBBBBBBBBBB..",
    "..SBBBBBBBBBBS..",
    "...SSSSSSSSSS...",
    "....BB....BB....",
    "....SS....SS....",
    "................",
]

ANTENNA = {(0, 7): "A", (0, 8): "A", (1, 7): "B", (2, 7): "B"}
SPROUT = {(1, 6): "A", (1, 9): "A", (2, 7): "B", (2, 8): "B", (0, 5): "A", (0, 10): "A"}
HEADSET = {(5, 1): "A", (6, 1): "A", (7, 1): "A", (5, 14): "A", (6, 14): "A", (7, 14): "A",
           (2, 4): "A", (2, 5): "A", (2, 6): "A", (2, 7): "A", (2, 8): "A", (2, 9): "A",
           (2, 10): "A", (2, 11): "A", (3, 3): "A", (3, 12): "A", (4, 2): "A", (4, 13): "A"}
LOOKS = [ANTENNA, SPROUT, HEADSET]


def hex_rgb(code):
    return tuple(int(code[i:i + 2], 16) for i in (0, 2, 4))


def mix(rgb, other, amount):
    return tuple(round(c + (o - c) * amount) for c, o in zip(rgb, other))


def sprite(color, look):
    rows = [list(row) for row in BASE]
    for (y, x), cell in look.items():
        rows[y][x] = cell
    body = hex_rgb(color)
    paint = {
        "B": body + (255,),
        "S": mix(body, (0, 0, 0), 0.35) + (255,),
        "A": mix(body, (255, 255, 255), 0.45) + (255,),
        "E": (24, 24, 28, 255),
        "W": (245, 245, 240, 255),
        "M": mix(body, (0, 0, 0), 0.55) + (255,),
        ".": (0, 0, 0, 0),
    }
    return [[paint[cell] for cell in row] for row in rows]


def png(pixels):
    height, width = len(pixels), len(pixels[0])
    raw = b"".join(b"\x00" + b"".join(bytes(px) for px in row) for row in pixels)

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def scale(pixels, factor):
    return [[px for px in row for _ in range(factor)] for row in pixels for _ in range(factor)]


def main():
    OUT.mkdir(exist_ok=True)
    faces = []
    # Colors cycle fastest, so neighbouring cards never share a color.
    for look in LOOKS:
        for color in COLORS:
            faces.append(sprite(color, look))
    for i, face in enumerate(faces, start=1):
        (OUT / f"helper-{i:02d}.png").write_bytes(png(scale(face, SCALE)))

    gap = [(20, 20, 24, 255)] * 2
    sheet = []
    for look in range(len(LOOKS)):
        band = faces[look * len(COLORS):(look + 1) * len(COLORS)]
        for y in range(16):
            sheet.append(sum((face[y] + gap for face in band), []))
        sheet.append([(20, 20, 24, 255)] * len(sheet[-1]))
    sheet = [[(20, 20, 24, 255) if px[3] == 0 else px for px in row] for row in sheet]
    (OUT / "sheet.png").write_bytes(png(scale(sheet, 6)))
    print(f"wrote {len(faces)} faces and sheet.png to {OUT}")


if __name__ == "__main__":
    main()
