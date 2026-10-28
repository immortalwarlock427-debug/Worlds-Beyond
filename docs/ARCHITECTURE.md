# How the site fits together

## Files

- Navigation: a top-level Character/Battlemap switch and nested character sub-tabs. `js/app.js` toggles the existing section nodes with `data-sheet-section`; no duplicated data or new persistence format. URL fragments `#map`, `#status`, `#sheet` and `#sheet/<tab>` remain supported.
- `index.html` holds the markup for both views (Sheet and Battlemap, switched with `#sheet` / `#map` in the link). Character Export, Import, and Clear actions are in the top toolbar and work from either view.
- `css/sheet.css` holds every style. Colors are tokens on `:root` with a dark theme.
- `js/maps.js` defines `window.WB_MAPS`, the maps that come with the site. Add a map there; the app needs no change.
- `js/status.js` owns the character-level status screen and manual condition timers. The status UI summarizes existing `js/abilities.js` effects without copying the effective stats into another save.
- `js/abilities.js` owns the player-built Ability Library (search, categories, favorites, metadata); it stores data on the character, not the game, and does not change combat math.
- `js/resources.js` owns the optional custom resource manager; its resources live on the character, not the game. Existing Mana/Holy Power values remain intact and may be hidden.
- `js/app.js` is the main application script for now. Its sections, in order: rules data (stats, milestones, gear),
  loading and saving, rules math, pools, trackers, AP and movement, Command, defenses, dice and attacks, health and
  death, stat increases, equipment and the Forge, drag and drop, advancement, portraits, the battlemap, rendering,
  export and import. Splitting it into modules is planned with the DM screen (see the roadmap).

## Two separate saves

The browser keeps two things apart, because a character and a game have different owners once the site is shared:

| localStorage key | What it holds | Who will own it online |
|---|---|---|
| `worlds-beyond-sheet-v1` | One **character**: fields, stats, gear, AP, Health, portraits, and an `id` | The player |
| `worlds-beyond-game-v1` | The **game**: which map, every character's token (by character `id`), enemies, explored fog, how the map is drawn | The DM |

- **Export character** writes only the character (`{ format: 'worlds-beyond-character', version: 1, state }`).
  The battlemap never travels with a character.
- A character's `id` (`c` + letters and digits) is how the game knows which token is theirs: `game.tokens[id]`.
- Saves from drafts before the website kept the battlemap inside the character. When one loads, its map, token,
  enemies and fog move into the game if this browser's game hasn't been started, and leave the character either way.

### The game object

```
{
  map:    { id, rev, cols, rows, free, fogOff },   // cols and rows only matter for the blank grid
  tokens: { [characterId]: { x, y } },            // squares are column x and row y, from 0
  fog:    { [mapId]: { rev, seen: '0101…' } },     // squares the party has seen, row by row
  foes:   [ { id, map, x, y, name, hp, max, ev, ar } ],
  view:   { grid, terrainOn, reachOff }            // how this browser draws the map
}
```

## The battlemap's rules, as coded

- **Movement:** every square is 5 ft, diagonals included; difficult terrain (rubble, water, bones) is 10 ft; you
  can't slip diagonally between two blocked squares that touch at a corner. Paying goes through the same code as
  the Movement panel: leftover feet, then Surge, then AP from a Command, then your own AP.
- **Planning on what you know:** a route treats squares you haven't seen as open floor and only avoids enemies you
  can see. The walk checks each next square as you reach it; if something you couldn't see is in the way (a wall,
  an enemy, or difficult terrain you can't afford), you stop next to it and pay only for the distance walked.
- **Sight:** a square is visible if a straight line reaches it without passing through walls, pillars, sealed doors,
  burial niches or magical darkness, and it's lit or within your sight in the dark. The squares next to you are always
  visible (except magical darkness). Sight in the dark = the farther of Darkvision (sheet, plus gear) and the light
  you carry (sheet or the map's Light picker, or gear that sheds light).
- **Light:** a map is `light: 'lit'` or `'dark'`. A dark map lists `lights` ({ x, y, ft }), each lighting the squares
  within that distance that it can reach in a straight line. `void` rows mark magical darkness.
- **Enemies:** standing enemies block movement through and onto their square; downed ones can be walked past but
  not stood on. Attacks need the target in range (5 ft unless the weapon's Range says otherwise) and a clear line.
  A hit meets or beats Evasion, and a natural 20 always hits and can't be dodged (Block and Parry still work). Armor Rating comes off each hit (for a two-weapon
  attack, each hand separately, the off-hand after halving).
