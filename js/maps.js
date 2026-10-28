// Maps that come with the site. Each map is a grid of 5 ft squares; x is the column and y the row, both from 0.
//
// terrain: one string per row. # wall, O pillar, B broken pillar, r rubble, w shallow water, b bones, s stairs,
//   d open door, x sealed door, c sarcophagus, n burial niche, f brazier, u urns, a dais; anything else is floor.
// light: 'lit' means you can see anything in line of sight. 'dark' means you only see lit squares, plus the
//   squares within your sight in the dark (the farther of your darkvision and the light you carry).
// lights: on a dark map, what lights it up: { x, y, ft } lights every square within ft of (x, y) that it can
//   reach in a straight line. These match the light sources the picture was painted with (maptools/render.py).
// void: optional rows like terrain, where # marks magical darkness that nobody can see into or through.
// links: standing on a square of that letter offers to take you to another map, arriving on a set square.
// The pictures are drawn by the scripts in maptools/ (see maptools/README.md).
window.WB_MAPS = {
  blank: { name: 'Blank grid', light: 'lit' },

  'stone-hall': {
    name: 'Stone Hall (sample)', short: 'Stone Hall', rev: 2, cols: 30, rows: 15,
    img: 'maps/stone-hall-2.webp', start: { x: 16, y: 13 }, light: 'lit',
    links: [{ ch: 's', to: 'barrow', arrive: { x: 22, y: 8 }, go: 'Go down', what: 'Stairs down into the barrow', done: 'You went down the stairs into the barrow.', dir: 'down' }],
    terrain: [
      '##############################',
      '###############....######..###',
      '####rr.#######......####....##',
      '###rr.....##..O...O...O..rrr.#',
      '###rr..B..#.............rrrr.#',
      'sss.......#...............rr.#',
      'sss.......d...O...O...O......#',
      'sss.......#..................#',
      '###....O..#..............ww..#',
      '###..r....##..O...O...O.wwww.#',
      '####.rr..###...........wwwww##',
      '####rr..#####...rr.....wwww###',
      '##############..rrr....#######',
      '###############....###########',
      '################..############'
    ]
  },

  barrow: {
    name: 'Barrow under Stone Hall (sample)', short: 'Barrow', rev: 1, cols: 26, rows: 18,
    img: 'maps/barrow.webp', dark: true, start: { x: 22, y: 8 }, light: 'dark',
    lights: [
      // braziers in the burial hall and around the jarl's tomb
      { x: 2, y: 3, ft: 20 }, { x: 13, y: 3, ft: 20 }, { x: 2, y: 15, ft: 20 }, { x: 13, y: 15, ft: 20 },
      { x: 5, y: 13, ft: 20 }, { x: 10, y: 13, ft: 20 },
      // daylight coming down the stairs
      { x: 25, y: 8, ft: 15 }, { x: 25, y: 9, ft: 15 },
      // glowing fungus in the flooded crypt
      { x: 17, y: 12, ft: 10 }, { x: 19, y: 12, ft: 10 }, { x: 20, y: 15, ft: 10 },
      // candles in the two burial niches where the dead have their eyes open, and the sealed door's cold glow
      { x: 15, y: 7, ft: 5 }, { x: 19, y: 7, ft: 5 }, { x: 8, y: 3, ft: 5 }
    ],
    links: [{ ch: 's', to: 'stone-hall', arrive: { x: 3, y: 6 }, go: 'Go up', what: 'Stairs up to Stone Hall', done: 'You climbed the stairs back up to Stone Hall.', dir: 'up' }],
    terrain: [
      '##########################',
      '##########################',
      '#######xx#################',
      '##f..........f############',
      '##..........rr############',
      '##...........r############',
      '##..O.c..c.O..#n#n#n#n####',
      '##....c..c.............###',
      '##.b........b...b......sss',
      '##....c..c..........b..sss',
      '##..O.c..c.O...........###',
      '##.....b......#n##.##n####',
      '##....aaaa....##u....u####',
      '##...faccaf...##..ww..####',
      '##....acca....##..www.####',
      '##f...aaaa...f##bwww.u####',
      '##########################',
      '##########################'
    ]
  }
};
