# Worlds Beyond

A character sheet, status effects view and battlemap for **Worlds Beyond**, a homebrew D&D combat framework built on 8 stats
(STR, VIT, DEX, AGL, INT, WIS, CHA, FTH) and Action Points. It's growing into a lightweight, Foundry-style tool
where a DM runs a game and players join with their characters.

The rules live in Notion (D&D > Game Systems). This site follows them; when a rule changes, the site changes with it.
The live site is at https://immortalwarlock427-debug.github.io/Worlds-Beyond/.

## What's here now

The Character Sheet uses Overview, Attributes, Equipment, Abilities and Status Effects tabs so players can switch without scrolling through the full sheet. Battlemap is a separate main destination. Character save files and game/map saves remain separate.

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

## Offline DM Room (Draft 32)

Open `dm.html` or select **Open DM Room** on the character sheet. This is a same-browser, **offline/local-only** combat tracker built for a DM:

1. Import multiple exported character `.json` files using **Import selected files** (each becomes a compact encounter snapshot). Or create enemies/NPCs manually.
2. Review each character's Health, maximum Health, Armor Rating, AP, Death Threshold and initiative. Edit any numbers before combat; enter the actual initiative **total** from a roll, not just its modifier.
3. Select **Start encounter**. The current actor is highlighted. Use **Next turn**, per-actor AP spending, damage, healing, and stabilization controls. AP refresh and 4 Health bleeding at turn start follow `WBCombat` rules.
4. The encounter saves automatically to the optional `game.encounter` field in `worlds-beyond-game-v1`; player `worlds-beyond-sheet-v1` data and JSON files are not overwritten. **New encounter** clears only the saved encounter after confirmation.

**Important limitations:** The tracker does not synchronize other devices or browser tabs, update the imported player character files, or move tokens on the existing battlemap. It does not automatically roll initiative or attack dice; enter already-rolled raw damage per hit (resistance then Armor Rating is applied automatically). Do not open the sheet and DM room simultaneously in different tabs for active editing: separate tabs may overwrite the game save. Imported advancement data may be incomplete; warnings tell you when to verify Health before combat. There is no account login or secure multiplayer authorization yet.
