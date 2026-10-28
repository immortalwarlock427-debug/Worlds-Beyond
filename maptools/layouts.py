"""Terrain layouts. # wall, . floor, O pillar, B broken pillar, r rubble, w water, s stairs,
d open door, x sealed door, c sarcophagus, n burial niche, b bones, f brazier, u urns, a dais (floor)."""

def grid(w, h, ch='#'):
    return [[ch] * w for _ in range(h)]

def rect(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch

def put(g, pts, ch):
    for x, y in pts:
        g[y][x] = ch

HALL_OLD = [
    "####################",
    "#####....######..###",
    "####......####....##",
    "##..O...O...O..rrr.#",
    "#.............rrrr.#",
    "................rr.#",
    "....O...O...O......#",
    "...................#",
    "#..............ww..#",
    "##..O...O...O.wwww.#",
    "##...........wwwww##",
    "###...rr.....wwww###",
    "####..rrr....#######",
    "#####....###########",
    "####################",
]

def stone_hall():
    g = grid(30, 15)
    for y, row in enumerate(HALL_OLD):
        for x, ch in enumerate(row):
            g[y][x + 10] = ch
    # the old west opening becomes a wall with one open door
    g[5][10] = '#'; g[7][10] = '#'; g[6][10] = 'd'
    # a south entrance out of the hall
    put(g, [(16, 14), (17, 14)], '.')
    # ruined antechamber to the west
    rect(g, 3, 3, 9, 10, '.')
    rect(g, 4, 2, 6, 2, '.')
    put(g, [(3, 3), (9, 10), (3, 10)], '#')
    put(g, [(4, 11), (5, 11), (6, 11), (7, 11)], '.')
    put(g, [(3, 3), (4, 3), (3, 4), (4, 2), (5, 2), (4, 4)], 'r')   # collapsed corner
    put(g, [(5, 9), (5, 10), (6, 10), (4, 11), (5, 11)], 'r')        # fallen pillar and debris
    put(g, [(7, 4)], 'B')                                             # broken pillar stump
    put(g, [(7, 8)], 'O')
    # stairs going down to the west, 3 wide, off the map edge
    rect(g, 0, 5, 2, 7, 's')
    put(g, [(0, 4), (1, 4), (2, 4), (0, 8), (1, 8), (2, 8)], '#')
    return ["".join(r) for r in g]

def barrow():
    W, H = 26, 18
    g = grid(W, H)
    # central burial hall
    rect(g, 2, 3, 13, 15, '.')
    put(g, [(2, 3), (13, 3), (2, 15), (13, 15), (5, 13), (10, 13)], 'f')   # braziers
    put(g, [(4, 6), (11, 6), (4, 10), (11, 10)], 'O')                     # pillars
    put(g, [(6, 6), (6, 7), (9, 6), (9, 7), (6, 9), (6, 10), (9, 9), (9, 10)], 'c')  # sarcophagi
    rect(g, 6, 12, 9, 15, 'a')                                            # dais
    put(g, [(7, 13), (8, 13), (7, 14), (8, 14)], 'c')                     # the jarl's tomb
    put(g, [(7, 2), (8, 2)], 'x')                                         # sealed puzzle door
    put(g, [(12, 4), (13, 4), (13, 5)], 'r')                              # collapsed corner
    put(g, [(3, 8), (12, 8), (7, 11)], 'b')                               # bones
    # entry corridor with burial niches
    rect(g, 14, 7, 22, 10, '.')
    put(g, [(15, 6), (17, 6), (19, 6), (21, 6), (15, 11), (21, 11)], 'n')
    put(g, [(16, 8), (20, 9)], 'b')
    # stairs back up, to the east
    rect(g, 23, 8, 24, 9, 's')
    put(g, [(25, 8), (25, 9)], 's')
    # flooded side crypt off the corridor
    rect(g, 18, 11, 18, 11, '.')
    rect(g, 16, 12, 21, 15, '.')
    put(g, [(18, 13), (19, 13), (18, 14), (19, 14), (20, 14), (17, 15), (18, 15), (19, 15)], 'w')
    put(g, [(16, 12), (21, 12), (21, 15)], 'u')
    put(g, [(16, 15)], 'b')
    return ["".join(r) for r in g]

if __name__ == '__main__':
    for name, rows in [('stone_hall', stone_hall()), ('barrow', barrow())]:
        print(name, len(rows[0]), 'x', len(rows))
        for i, r in enumerate(rows):
            print('%2d %s' % (i, r))
