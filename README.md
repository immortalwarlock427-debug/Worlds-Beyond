# Worlds Beyond

A character sheet, status effects view and battlemap for **Worlds Beyond**, a homebrew D&D combat framework built on 8 stats
(STR, VIT, DEX, AGL, INT, WIS, CHA, FTH) and Action Points. It's growing into a lightweight, Foundry-style tool
where a DM runs a game and players join with their characters.

The rules live in Notion (D&D > Game Systems). This site follows them; when a rule changes, the site changes with it.
The live site is at https://immortalwarlock427-debug.github.io/Worlds-Beyond/.

## What's here now

- **Character sheet:** stats with milestones at 21 and 28, Health and Mana built level by level, death and dying,
  AP, reactions, Wonder, movement, Command, defenses (Block, Dodge, Parry), a Diablo-style paper doll with a Forge,
  weapon attacks, advancement, export and import of a character as a `.json` file.
- **Battlemap:** 5 ft squares, moves that spend AP, sample maps (Stone Hall and the Barrow beneath it) with stairs,
  fog of war with line of sight and light, step-by-step movement, and enemies you can place, target and attack.

## Running it

It's plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

then go to http://localhost:8000. Everything saves in the browser (localStorage). Use **Export character** to move a
character between browsers.

## Hosting (GitHub Pages)

The site is served straight from the `main` branch. In the repository's settings, under Pages, set the source to
deploy from the `main` branch, root folder. Every push updates the site within a minute or two. The `.nojekyll`
file makes GitHub serve the files exactly as they are.

## Layout

```
index.html          the page: sheet and battlemap markup
css/sheet.css       all the styles
js/maps.js          the maps that come with the site: terrain, lighting, stairs
js/app.js           the app: rules, sheet, battlemap
maps/               map pictures (drawn by maptools/, no grid lines baked in)
maptools/           Python scripts that draw the map pictures
tools/              build_single.py makes a one-file version for the Claude artifact
docs/               CONTEXT.md (rules and project context), ARCHITECTURE.md (code and saves), ROADMAP.md
AGENTS.md           instructions for AI assistants (CLAUDE.md points to it)
```

See [docs/CONTEXT.md](docs/CONTEXT.md) for the rules and project context, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for how the data is stored and [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.
