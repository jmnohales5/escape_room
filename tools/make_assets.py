#!/usr/bin/env python3
"""Generate every pixel-art SVG used by the game.

Each sprite is painted on a tiny grid (16x16) with rectangles, an outline is
added automatically, and the result is written as an SVG made of <rect>s.
Run from the repo root:  python3 tools/make_assets.py
"""
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

# One-letter palette so the painting code stays short
PAL = {
    "k": "#1b1226",  # outline
    "s": "#e3e9f5",  # steel light
    "m": "#9aa5c0",  # steel mid
    "d": "#59627f",  # steel dark
    "r": "#d03a34",  # red
    "R": "#7d1b28",  # dark red
    "f": "#f2b98e",  # skin
    "b": "#9a5f35",  # brown
    "B": "#573319",  # dark brown
    "y": "#f7cb3f",  # gold
    "Y": "#b98a1c",  # dark gold
    "w": "#ffffff",
    "u": "#3f64e0",  # blue
    "U": "#243b9c",  # dark blue
    "e": "#ebe5cf",  # bone
    "c": "#5ce1e6",  # cyan glow
    "o": "#ff8a1f",  # orange flame
}


class Sprite:
    def __init__(self, w=16, h=16):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px[yy][xx] = c

    def dot(self, x, y, c):
        self.px[y][x] = c

    def outline(self, c="k"):
        """Paint every empty pixel that touches a painted one."""
        new = [row[:] for row in self.px]
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and self.px[ny][nx] is not None:
                            new[y][x] = c
                            break
        self.px = new
        return self

    def svg(self):
        rects = []
        for y in range(self.h):
            x = 0
            while x < self.w:
                c = self.px[y][x]
                if c is None:
                    x += 1
                    continue
                run = 1
                while x + run < self.w and self.px[y][x + run] == c:
                    run += 1
                rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="{1}" fill="{PAL.get(c, c)}"/>')
                x += run
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
            f'width="{self.w}" height="{self.h}" shape-rendering="crispEdges">\n'
            + "\n".join(rects)
            + "\n</svg>\n"
        )

    def save(self, name):
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(self.svg())


# ---------------------------------------------------------------- hero ----
def hero(view, frame):
    s = Sprite()
    if view == "down":
        s.rect(7, 1, 2, 1, "r"); s.rect(6, 2, 4, 1, "r")            # plume
        s.rect(5, 3, 6, 3, "m"); s.rect(5, 3, 6, 1, "s")            # helmet
        s.rect(6, 4, 4, 2, "f"); s.dot(6, 4, "k"); s.dot(9, 4, "k")  # face + eyes
        s.rect(6, 6, 4, 1, "d")                                      # gorget
        s.rect(1, 8, 3, 5, "u"); s.rect(2, 9, 1, 3, "y")             # shield
        s.rect(5, 7, 6, 4, "r"); s.rect(7, 8, 2, 2, "y")             # tunic + emblem
        s.rect(3, 7, 2, 2, "m"); s.rect(11, 7, 2, 2, "m")            # pauldrons
        s.rect(3, 9, 2, 2, "d"); s.rect(11, 9, 2, 2, "d")            # gauntlets
        s.rect(5, 11, 6, 1, "b"); s.rect(7, 11, 2, 1, "y")           # belt
        s.rect(13, 4, 1, 6, "s"); s.rect(12, 10, 3, 1, "y"); s.rect(13, 11, 1, 1, "b")  # sword
    elif view == "up":
        s.rect(7, 1, 2, 1, "r"); s.rect(6, 2, 4, 1, "r")
        s.rect(5, 3, 6, 3, "m"); s.rect(5, 3, 6, 1, "s"); s.rect(5, 5, 6, 1, "d")
        s.rect(6, 6, 4, 1, "d")
        s.rect(5, 7, 6, 5, "R"); s.rect(6, 8, 4, 3, "u"); s.rect(7, 9, 2, 1, "y")  # cape + shield
        s.rect(3, 7, 2, 2, "m"); s.rect(11, 7, 2, 2, "m")
        s.rect(3, 9, 2, 2, "d"); s.rect(11, 9, 2, 2, "d")
        s.rect(5, 11, 6, 1, "b")
        s.rect(13, 4, 1, 6, "s"); s.rect(12, 10, 3, 1, "y"); s.rect(13, 11, 1, 1, "b")
    else:  # side view, facing right
        s.rect(4, 1, 3, 1, "r"); s.rect(3, 2, 4, 1, "r")
        s.rect(5, 3, 5, 3, "m"); s.rect(5, 3, 5, 1, "s")
        s.rect(8, 4, 2, 2, "f"); s.dot(9, 4, "k")
        s.rect(6, 6, 3, 1, "d")
        s.rect(3, 7, 2, 5, "R")
        s.rect(5, 7, 5, 4, "r")
        s.rect(7, 8, 3, 2, "d")
        s.rect(10, 8, 5, 1, "s"); s.rect(10, 7, 1, 3, "y")
        s.rect(5, 11, 5, 1, "b")
    # legs (two walk frames)
    if view == "right":
        if frame == 0:
            s.rect(5, 12, 2, 2, "m"); s.rect(8, 12, 2, 2, "m")
            s.rect(5, 14, 2, 1, "B"); s.rect(8, 14, 3, 1, "B")
        else:
            s.rect(6, 12, 3, 2, "m"); s.rect(6, 14, 4, 1, "B")
    else:
        if frame == 0:
            s.rect(5, 12, 2, 2, "m"); s.rect(9, 12, 2, 2, "m")
            s.rect(5, 14, 2, 1, "B"); s.rect(9, 14, 2, 1, "B")
        else:
            s.rect(5, 12, 2, 1, "m"); s.rect(5, 13, 2, 1, "B")
            s.rect(9, 12, 2, 2, "m"); s.rect(9, 14, 2, 1, "B")
    return s.outline()


# ------------------------------------------------------------ skeleton ----
def skeleton(frame):
    s = Sprite()
    s.rect(4, 1, 8, 4, "e"); s.rect(5, 5, 6, 1, "e")                 # skull + jaw
    s.rect(5, 2, 2, 2, "k"); s.rect(9, 2, 2, 2, "k")                 # eye sockets
    s.dot(6, 3, "r"); s.dot(10, 3, "r")                              # glowing eyes
    s.dot(7, 4, "k"); s.dot(8, 4, "k")                               # nose
    s.dot(6, 5, "k"); s.dot(8, 5, "k")                               # teeth gaps
    s.rect(7, 6, 2, 5, "e")                                          # spine
    s.rect(4, 7, 8, 1, "e"); s.rect(5, 9, 6, 1, "e")                 # ribs
    s.rect(3, 7, 1, 4, "e"); s.rect(12, 7, 1, 4, "e")                # arms
    s.rect(6, 10, 4, 1, "e")                                         # pelvis
    s.rect(13, 3, 1, 7, "d"); s.rect(12, 10, 3, 1, "Y")              # rusty sword
    if frame == 0:
        s.rect(6, 11, 1, 3, "e"); s.rect(9, 11, 1, 3, "e")
        s.rect(5, 14, 2, 1, "e"); s.rect(9, 14, 2, 1, "e")
    else:
        s.rect(6, 11, 1, 2, "e"); s.rect(5, 13, 2, 1, "e")
        s.rect(9, 11, 1, 3, "e"); s.rect(9, 14, 2, 1, "e")
    return s.outline()


# --------------------------------------------------------------- tiles ----
def wall():
    rnd = random.Random(7)
    s = Sprite()
    s.rect(0, 0, 16, 16, "#4d4b72")
    for r in range(4):
        y0 = r * 4
        s.rect(0, y0, 16, 1, "#6a68a0")          # lit top edge of each brick
        s.rect(0, y0 + 3, 16, 1, "#2a2842")      # mortar line
        for vx in ((7, 15) if r % 2 == 0 else (3, 11)):
            s.rect(vx, y0, 1, 4, "#2a2842")
    for _ in range(10):
        s.dot(rnd.randrange(16), rnd.randrange(16), rnd.choice(["#3f3d62", "#5a5890"]))
    return s


def floor(variant=0):
    rnd = random.Random(11 + variant)
    s = Sprite()
    s.rect(0, 0, 16, 16, "#2b2646")
    s.rect(0, 0, 16, 1, "#1b1730"); s.rect(0, 0, 1, 16, "#1b1730")
    s.rect(0, 8, 16, 1, "#1b1730"); s.rect(8, 0, 1, 8, "#1b1730")
    s.rect(1, 1, 7, 1, "#352f58"); s.rect(1, 9, 15, 1, "#352f58")
    for _ in range(8):
        s.dot(rnd.randrange(16), rnd.randrange(16), rnd.choice(["#241f3d", "#38325c"]))
    if variant:  # a crack
        for x, y in ((10, 11), (11, 11), (11, 12), (12, 12), (12, 13), (13, 13)):
            s.dot(x, y, "#15112a")
    return s


def torch(frame):
    s = Sprite()
    s.rect(7, 8, 2, 5, "B"); s.rect(6, 8, 4, 1, "b")                 # handle + cup
    if frame == 0:
        s.rect(7, 3, 2, 1, "y"); s.rect(6, 4, 4, 2, "o"); s.rect(7, 6, 2, 2, "y")
    else:
        s.rect(8, 2, 1, 1, "y"); s.rect(6, 4, 4, 2, "o"); s.rect(7, 3, 2, 1, "o"); s.rect(7, 6, 2, 2, "y")
    return s


def door(opened):
    s = Sprite()
    if not opened:
        s.rect(1, 0, 14, 16, "b")
        for x in (4, 8, 12):
            s.rect(x, 0, 1, 16, "B")
        s.rect(1, 3, 14, 2, "d"); s.rect(1, 11, 14, 2, "d")           # iron bands
        for x in (2, 6, 10, 13):
            s.dot(x, 3, "m"); s.dot(x, 11, "m")
        s.rect(6, 6, 4, 5, "Y"); s.rect(6, 6, 4, 1, "y")              # lock plate
        s.dot(7, 7, "k"); s.dot(8, 7, "k"); s.dot(7, 8, "k"); s.dot(8, 8, "k"); s.dot(7, 9, "k")  # keyhole
    else:
        s.rect(1, 0, 14, 16, "#0d0a18")
        s.rect(1, 0, 3, 16, "b"); s.rect(3, 0, 1, 16, "B")
        s.rect(4, 3, 1, 2, "d"); s.rect(4, 11, 1, 2, "d")
        s.rect(6, 2, 8, 14, "#f7e08a")                                # light from outside
        s.rect(8, 4, 4, 12, "#fff6c8")
    return s.outline()


def gate_riddle():
    s = Sprite()
    s.rect(0, 0, 16, 16, "#1b1226")
    for x in (1, 5, 9, 13):
        s.rect(x, 0, 2, 16, "m"); s.rect(x, 0, 1, 16, "s")           # iron bars
    s.rect(0, 2, 16, 2, "d"); s.rect(0, 12, 16, 2, "d")              # cross bars
    s.rect(4, 4, 8, 8, "U"); s.rect(4, 4, 8, 1, "y"); s.rect(4, 11, 8, 1, "y")
    s.rect(4, 4, 1, 8, "y"); s.rect(11, 4, 1, 8, "y")                 # plaque border
    for x, y in ((6, 5), (7, 5), (8, 5), (8, 6), (7, 7), (7, 9)):     # "?"
        s.dot(x, y, "w")
    return s


def gate_rune():
    s = Sprite()
    s.rect(0, 0, 16, 16, "d")
    s.rect(0, 0, 16, 1, "m"); s.rect(0, 15, 16, 1, "#2a2842")
    s.rect(0, 7, 16, 1, "#2a2842"); s.rect(7, 0, 1, 7, "#2a2842"); s.rect(3, 8, 1, 7, "#2a2842"); s.rect(11, 8, 1, 7, "#2a2842")
    s.rect(3, 3, 10, 10, "#14102a")
    for x, y in ((8, 3), (7, 4), (9, 4), (6, 5), (10, 5), (5, 6), (11, 6), (4, 7), (12, 7),
                 (5, 8), (11, 8), (6, 9), (10, 9), (7, 10), (9, 10), (8, 11)):
        s.dot(x, y, "c")
    s.rect(7, 6, 3, 3, "c"); s.dot(8, 7, "w")
    return s


def key():
    s = Sprite()
    s.rect(2, 5, 5, 5, "y"); s.rect(3, 6, 3, 3, None); s.dot(2, 5, "w")  # bow with a hole
    s.rect(7, 7, 7, 2, "y"); s.rect(7, 8, 7, 1, "Y")                  # shaft
    s.rect(11, 9, 1, 2, "y"); s.rect(13, 9, 1, 3, "y")                # teeth
    return s.outline()


def spikes(state):
    s = floor(0)
    spots = ((2, 2), (10, 2), (2, 10), (10, 10))
    for x, y in spots:
        if state == "down":
            s.rect(x, y + 1, 4, 3, "k"); s.rect(x, y, 4, 1, "#4a4468")
        elif state == "warn":
            s.rect(x, y + 1, 4, 3, "k"); s.dot(x + 1, y + 1, "m"); s.dot(x + 2, y + 1, "m")
        else:
            s.rect(x, y + 3, 4, 1, "d"); s.rect(x, y + 2, 4, 1, "m")
            s.rect(x + 1, y + 1, 2, 1, "s"); s.dot(x + 1, y, "w"); s.dot(x + 2, y, "w")
    return s


def heart(full):
    s = Sprite(9, 8)
    rows = [
        ".rr.rr...",
        "rrrrrrr..",
        "rrrrrrr..",
        ".rrrrr...",
        "..rrr....",
        "...r.....",
    ]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "r":
                s.dot(x + 1, y + 1, "r" if full else "#2b2646")
    if full:
        s.dot(2, 2, "w")
    return s.outline("k" if full else "d")


def rune(kind):
    s = Sprite()
    col = {"tri": "#ff5a52", "dia": "#58a0ff", "cross": "#4ee07a", "moon": "#ffd23f"}[kind]
    if kind == "tri":
        for i in range(10):
            w = 2 + i
            s.rect(8 - w // 2, 3 + i, w, 1, col)
    elif kind == "dia":
        for i in range(-5, 6):
            w = 2 * (6 - abs(i))
            s.rect(8 - w // 2, 8 + i, w, 1, col)
    elif kind == "cross":
        s.rect(6, 2, 4, 12, col); s.rect(2, 6, 12, 4, col)
    else:
        for y in range(16):
            for x in range(16):
                d = (x - 7.5) ** 2 + (y - 7.5) ** 2
                if 6 <= d <= 30:
                    s.dot(x, y, col)
        s.rect(8, 5, 3, 6, None)
    # light edge on the top-left
    for y in range(16):
        for x in range(16):
            if s.px[y][x] == col and (y == 0 or s.px[y - 1][x] is None or x == 0 or s.px[y][x - 1] is None):
                s.px[y][x] = "#ffffff"
    return s.outline()


def main():
    for view in ("down", "up", "right"):
        for f in (0, 1):
            hero(view, f).save(f"hero_{view}_{f}")
    for f in (0, 1):
        skeleton(f).save(f"skeleton_{f}")
        torch(f).save(f"torch_{f}")
    wall().save("wall")
    floor(0).save("floor")
    floor(1).save("floor_crack")
    door(False).save("door_locked")
    door(True).save("door_open")
    gate_riddle().save("gate_riddle")
    gate_rune().save("gate_rune")
    key().save("key")
    for st in ("down", "warn", "up"):
        spikes(st).save(f"spikes_{st}")
    heart(True).save("heart_full")
    heart(False).save("heart_empty")
    for k in ("tri", "dia", "cross", "moon"):
        rune(k).save(f"rune_{k}")
    print("assets written to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
