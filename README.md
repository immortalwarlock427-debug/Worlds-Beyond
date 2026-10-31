# Worlds Beyond

A customizable character sheet, status effects view and battlemap for **Worlds Beyond**, a homebrew D&D combat framework using STR, VIT, DEX, AGL, INT, WIS, CHA, FTH and Action Points. Rules live in Notion → D&D > Game Systems; this repository implements them.

The live site is https://immortalwarlock427-debug.github.io/Worlds-Beyond/.

## Run and test

The site is plain HTML, CSS and JavaScript with no build step. Serve this folder:

```
python3 -m http.server 8000
```

Open `http://localhost:8000`. Characters and DM games save separately in this browser. Use **Export character** for a portable JSON backup; browser storage is not a backup and may be cleared by the browser or user. On iPhone, Safari → Share → Add to Home Screen can help keep the app accessible, but keep exports or cloud copies too. Home Screen and storage-retention behavior varies by browser and does not guarantee recovery.

Run `npm install`, `npx playwright install chromium`, and `npm test`. The browser tests start their own local server. See [TESTING.md](docs/TESTING.md) for CI and test details.

## Character Sheet

Overview starts with Health, AP/reactions and your current-form favorite abilities. Star abilities in the Abilities tab, then use them directly from Overview with the same costs, cooldowns and limited uses. **Character details** takes you to the editable name, portrait and profile below. **Character menu** holds Export/Import, Cloud Saves and secondary views; Clear sheet is separated under **Reset character** and still requires confirmation.

Overview, Attributes, Equipment, Abilities, Status Effects, Notes and Dice tabs provide editable stats, advancement, Health/Mana, AP, reactions, Wonder, defenses, equipment/Forge, custom resources, custom abilities and timed effects. Named forms can link portraits, select different worn gear and charge optional entry costs. Returning to Base is free. The separate Battlemap supports fog, light, terrain, targeting and AP-based movement.

Use **Notes** for session reminders, backstory, personality, languages and allies/connections. Notes save with your character, including JSON exports/imports and manual Cloud Saves. Session notes appear first on phones; the fields are plain text and do not change stats or ability uses.

Health buttons, manual corrections and potion healing now use the same saved-character calculations. Clearing current Health means full Health at the current maximum; clear the maximum to return to the current-stat formula. Manual corrections can remain above or below the maximum without adding Trauma. Actual healing that brings you above 0 adds Trauma once. Damage still applies the existing defense and Death's Mercy rules.

Start my turn and Long rest each commit their existing resets together. Turn processing keeps regeneration, effect/status timing and bleeding in order. Rest Undo restores rest trackers and concentration while keeping later notes, consumable quantities and manual statuses. Rests do not replenish consumables or remove manual conditions.

Use **Dice** for a free expression such as `3d6+2` and the last 20 timestamped results. Expand a result to show its details at the table. History includes sheet checks, attacks/damage, defenses, healing rolls, stat generation and short-rest/status rolls, and travels with character saves/exports/manual Cloud Saves. Viewing or clearing history never repeats costs or applies effects. Free dice use the expression as written and spend no AP or items.

For custom abilities, enter **Base AP cost** and optionally choose **Discounted by: STR, VIT, DEX, INT, WIS, CHA or FTH**. Cards and Overview favorites show the current price and its base. The discount uses your current modifier, with a minimum of half the base cost rounded up; negative modifiers increase the price, and blank/zero stays free. **None** keeps a flat cost and is the default for existing abilities.

Expand **Optional rolls** on an ability to choose independent attack, damage bonus and save-DC stats, damage dice/type and the target save. **Use** pays its costs once, then opens the existing roll popup; damage follows without another payment. Attack rolls follow the bottom dice mode and offer critical damage on a natural 20. Wonder/Defy Fate do not apply to attacks. Save DCs are shown for the target to resolve at the table. Blank roll fields keep the existing tracker-only behavior.

Use **New combat / End combat** beside **Start my turn** to track the current mode. Starting combat restores custom combat/round uses and Parry; ending combat restores nothing. Health, AP, reactions, resources, cooldowns and effects keep their values when modes change. In an ability, **Uses reset** chooses Long rest (the default), New combat or Turn start. Combat and outside allowances are separate. Outside uses return on long rest; round abilities can use a selected stat modifier or the same fixed count. Parry uses the DEX modifier outside combat.

In **Abilities → Milestone actions**, effective attributes unlock milestone actions with AP/use tracking, including: Indomitable status negation, Stratagem, Absolute Comprehension, Sixth Sense, Eyes of Truth, Commanding Presence and Miracle. Use opens the appropriate rule prompt, WIS check or target save DC. Combat and outside allowances remain separate; adjust Uses remaining to correct mistakes. Outcomes involving the GM or another creature resolve at the table. For **Singularity**, choose the hand in Equipment before pressing Attack or Opportunity attack; a miss still spends the use. On dual attacks it affects only the chosen hand. For **Titan's Might**, use its milestone button after a melee hit to track the free push/prone option; resolve the target at the table. Singularity criticals keep the actual natural die.

Health is current VIT × level; Mana/Holy Power is current INT/FTH × (level + 2), plus explicit pool gear. Changing a maximum shifts its current value by the same difference. Old characters keep their stored current pools on first migration and receive an old/new maximum notice. Obsolete advancement rolls and settled-gear records are removed; stat history and ASIs remain. AP starts at 15 and gains 2 every five levels, including beyond 20.

Weapon properties drive stat choices, Heavy/Paragon modifiers, Light dual attacks, Finesse criticals on 18–19, armor penetration and range bands. A dual off-hand hit omits its stat modifier before halving. Weapon and Block dice scale at levels 5/10/15/20; Fast Roll is optional and criticals roll every die. Roll-mode recommendations remain overridable.

Forge includes the current weapon/armor/shield tables and prices, armor classes, rare metals, signature reminders, pants and a strapped attachment that can coexist with arm guards. Pack capacity is advisory. Use explicit Draw/swap, Reload and Drink controls for discounted AP payments; generic consumable Use keeps custom costs at the table. Quickdraw is free.

Status Effects includes all 16 presets, editable effect DCs and source levels, Shake It Off, status-damage rolls and Stand up. Burning requires a roll; Bleeding ends with healing. The zero-Health state is labeled Dying. Other condition and target effects resolve at the table. Under Health & recovery, Short rest hit die rolls one explicit recovery and can apply it once.

In **Equipment → Forge**, round-based item abilities have an **Outside combat** setting: keep their turn reset, use the same limit per long rest, or choose a stat modifier per long rest. Existing items keep their old setting until edited. Equipped abilities offer **Use**, pips and a remaining-use number; these track charges, while you apply listed costs/effects at the table. Configured combat/outside allowances stay separate through swaps, forms and turns. Renaming an item or removing an earlier ability keeps the surviving abilities’ spent counts.

In **Equipment → Consumables**, add potions or other items with quantities, descriptions and optional healing dice (for example `2d6+2`). **Use** subtracts one and opens the result; **Apply healing to me** uses the existing Health rules once. Listed AP costs and other effects are handled at the table. Correct quantities directly in the list; editing a definition keeps the current count. Forms and rests do not refill consumables. The list travels with local saves, v1 files and manual Cloud Saves.

If another tab restores, imports or edits this character, an older sheet pauses autosave. Export any edits you want to keep, then select **Reload saved character**. Unreadable saved data is kept and can be downloaded from the recovery notice. Separate browser tabs are not a transactional collaboration system; edit a character in one tab at a time.

## Offline DM Room

Open `dm.html` or **Open DM Room** to import character JSON files as encounter snapshots, create NPCs, edit initiative and combat values, and run turns, damage, healing and stabilization. The tracker uses shared `WBCombat` rules and saves under the optional `game.encounter` field in the separate DM game record. Imported player files and the live character sheet are not rewritten.

Choose Blank Grid, Stone Hall or Barrow, select an actor, and click to place its token. **DM placement (free)** is for setup/corrections. During combat, **Combat movement (AP)** previews a validated route; **Confirm move** pays movement/AP and animates the token. Party/Enemy sides affect occupancy, and rough terrain costs more distance. The current actor is selected automatically. Token positions are tied to a map and remain separate from legacy character Battlemap tokens.

Enter already-rolled initiative and damage; the DM Room does not roll attack dice or authenticate player ownership. Review import warnings for missing advancement or omitted temporary buffs. **Grant Command AP** keeps the highest grant, up to 5; it does not stack. After combat, **Reuse roster / Edit setup** preserves the roster and placement for the next fight; **New empty roster** clears only the encounter after confirmation.

## Player Preview

`player.html` displays an imported PC's map, turn, Health/AP and movement and submits validated movement, AP spending and End Turn. DM and player tabs must use the same browser profile and origin. Seat selection can switch between local PCs and is not authentication. Other phones do not receive these changes; live multiplayer remains a design task.

## Cloud Saves

`cloud.html` provides manual private character copies using Supabase Auth and owner-only database policies. The existing project uses a public publishable key in `js/cloud-config.js`; no service-role keys belong in the client. Advanced settings support another test project.

Save, list, restore, delete and JSON backup are explicit actions. Each local copy remembers the cloud revision it last saved/restored, scoped to its project and account. A fresh list does not authorize overwriting a newer cloud revision. For a conflict or an older copy without a revision receipt, export local edits first, restore the newer cloud copy, then apply the edits you want to keep. Restoring keeps one undo backup in this browser. Cloud copies do not synchronize DM games or encounters. See [SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for setup, limits and verification.

## Hosting and repository layout

GitHub Pages serves `main` from the repository root (`.nojekyll` preserves static files). Netlify is configured for pull-request previews; production Netlify builds are skipped. Test a preview before approving a merge. Browser storage is separate for preview and production origins.

- `index.html`, `dm.html`, `player.html`, `cloud.html`: application pages.
- `js/`, `css/`: shared rules, persistence, controllers and styles.
- `maps/`: committed sample art; `maptools/` contains optional Python renderers.
- `tests/`, `e2e/`: Node contracts and real browser interaction checks.
- `supabase/`: database configuration and migrations.
- `tools/build_single.py`: optional Claude artifact, published only from merged `main`.

Read [CONTEXT.md](docs/CONTEXT.md) for current behavior and rules, [ARCHITECTURE.md](docs/ARCHITECTURE.md) for module/save contracts, [ROADMAP.md](docs/ROADMAP.md) for the staged work, and [AGENTS.md](AGENTS.md) before making changes.
