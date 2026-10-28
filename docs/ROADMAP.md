# Roadmap

## Battlemap
- Doors that open and close, and making the sealed ring door in the Barrow a puzzle.
- Uploading your own map picture, and a brush to paint walls, terrain, light and magical darkness onto it.
- More generated maps (the scripts in `maptools/` draw them in the same style).
- Tokens for allies.

## Sheet
- Navigation: two-level UI with separate Character Sheet / Battlemap destinations and a sticky row of Overview, Attributes, Equipment, Abilities, Status Effects tabs within Character Sheet. Legacy #sheet, #status and #map links still work; individual sections have #sheet/abilities etc. All original sheet and game saves stay unchanged.
- Custom resources: basic manager delivered in Draft 30; later connect resource costs to the universal ability builder, add reusable templates and per-form pools.
- Ability Library (capacity and quick use in next PR): separate maximum active/held creations from limited ability charges; keep an accessible Use button on collapsed and expanded cards. Future: named creations, bulk effects, and per-instance expiry.
- Ability Library v1: create, edit, duplicate, delete, favorite, categorize and search abilities; record optional AP/resource costs, cooldowns, durations, uses (blank = unlimited), descriptions and notes without automating activations. Activation prototype: Use button validates/deducts AP or chosen resources, starts cooldown/duration trackers, and spends limited charges; turn start counts down and long rest resets. Temporary Movement effects (ft/AP) implemented in draft: activated bonuses add to effective movement for their duration without modifying base stats; expire at turn start. Next PR: multiple effect rows per ability; Armor Rating, Evasion, the 8 stats, and custom resource max added. Future: resource current-value deltas, richer duration rules, triggers, combat reset, and status overview.
- Spells: a list with level and tier, mana cost from the Magic System table, AP cost 11 − INT or FTH mod
  (minimum 6), damage, area and save (DC 12 + mod), concentration, and a Cast button.
- Milestone buttons and trackers: Devastate and Singularity as toggles on attacks; pips for Indomitable, Miracle and
  the once-per-round ones; a New combat button.
- Block scaling and two-handed damage, once decided.
- Status Effects view: separate third tab showing active timed ability effects by source with applied bonuses and remaining turns, plus manually entered buffs, debuffs and conditions with optional timers. Effect-ending controls and status expiry work with the character save. Future: built-in combat/health conditions, per-effect target selection, conditions that change combat calculations, status presets, richer filtering.
- A conditions tracker, after the Exhaustion revamp.
- Character export/import/clear moved to the top, accessible from Sheet and Battlemap. Notes, consumables and currency. Visual polish. Later: set bonuses across slots.
- Ability Library enhancements: type, category, resource-cost, AP-cost and readiness/cooldown filters, sort order, and compact list implemented. **Ability Forms v1 (current PR):** create named forms/loadouts, assign abilities to one or more, share abilities across all forms, and switch available skills without resetting trackers; separate from portrait forms. Phase 2: two-way link between ability forms and existing portraits (selecting either updates the other) plus reversible form-specific modifiers for STR/VIT/DEX/AGL/INT/WIS/CHA/FTH (current PR). Current PR: form-specific custom resource availability and regeneration, balances preserved when switching, optional built-in Mana visibility per form. Equipment profiles (next PR): per-form worn slots with shared inventory, one active gear set at a time, Base/Copy/Clear controls, no reset of item uses or long-rest history. Later: separate built-in Mana balances if needed, form transitions/AP costs, tags/groups, saved filter presets, batch actions.

## Shared combat engine and offline encounter commands
- New `js/combat-core.js` extracts deterministic level/ASI stat math, modifiers, gear/Armor Rating, Action Point spending/refunds (Command first), and movement with Surge and leftover feet. The existing sheet now uses this same module.
- Attack/damage/defense/Death's Mercy resolution is now shared in `WBCombat` (current PR), including dual wielding and resistance. Validated encounter action processor now covers initiative, turns, AP, damage/healing, revisions and duplicate rejection; next: offline DM view importing multiple characters. Cloud authentication, sync, and live multiplayer follow after shared rules and save migrations are stable.

## Website

- **Foundation refactor (current PR):** `js/persistence.js` centralizes the existing character/game storage and character JSON import/export with injectable local and in-memory repository adapters; `js/game-state.js` centralizes the current map/token/fog/foe session normalizer for an offline DM screen. Original browser keys and export version are unchanged. Next foundation work: move pure stat/gear/AP/movement rules out of `js/app.js`; define explicit versioned character migrations and revisioned async cloud sync before connecting real accounts.

The sheet grows into a lightweight, Foundry-style tool (not built inside Claude). Done so far: the sheet and
battlemap are a static site on GitHub Pages, with the character and the game saved separately.

- **Games:** the DM creates a game; a "server" is just a game record with a join code. Players join with the code
  and bring their character.
- **Visibility:** the DM sees full sheets; other players see only the basic info each player chooses to share.
- **Combat screen:** the DM moves everyone into combat, with initiative order and creatures to target, and a
  battlemap of 5 ft squares where each player moves their own token, spending their AP by the Movement rules.
- **Stack:** this site as the front end, a hosted database with accounts and live sync (Supabase or Firebase, both
  with free tiers), and static hosting (GitHub Pages). No server machine to run.
- **Character format:** the sheet's exported `.json` file, so characters move between the sheet and the site.

### In this order

1. **Continue the core refactor:** extract reusable combat and character calculations from `js/app.js` with tests; persist via repository interfaces. Then build a **local DM screen** loading multiple exported character files, with no networking. Each screen must use the same rules instead of implementing competing calculations.
2. **A combat tracker** on it: initiative, Health, targets, then the battlemap with every character's token.
3. **Accounts, games with join codes, and live sync:** a hosted database with accounts (Supabase or Firebase, both
   have free tiers). The DM creates a game; players join with the code and bring their character.
4. **Per-player sharing:** the DM sees full sheets; other players see only what each player chooses to share.

## Cloud/mobile and multiplayer readiness

See [Cloud & Multiplayer Plan](CLOUD_MULTIPLAYER_PLAN.md). **Before adding cloud saves**, separate the reusable rules/save logic from DOM handlers, introduce versioned character migrations, and expose a local-first repository interface. Build an offline DM screen using shared rule functions, then choose one hosted authentication/database backend for multi-device saves and synchronized sessions. Enforce player/DM access on the backend rather than relying on client visibility. Keep character and game saves independent.

## Shared combat resolution follow-up

- **Current PR:** extend `WBCombat` for hit rolls, critical/extra damage, off-hand halving, per-hit armor, resistances, Overwhelming Force, defense reactions, saves, and Death Threshold/Mercy. The existing sheet delegates to those rules, preserving its UI and save shape.
- **Next:** an offline multi-character DM encounter tracker with typed combat commands/revisions; later authenticated players and online real-time session authorization. No cloud infrastructure is part of this phase.

## Encounter actions (new foundation)

- `WBEncounter` defines the DM-owned encounter record and validates action IDs/revisions, actor ownership hints, turn order and numeric payloads. It reuses shared combat math for AP, armor, bleeding and Death's Mercy. An optional `game.encounter` field round-trips through `WBGameState` without changing old saves.
- **Next feature:** first visible offline DM screen: import several exported character files into encounter snapshots; manage NPCs, initiative, health, AP and turns; use `WBEncounter.applyAction`. Later add a shared battlemap, trusted player movement, real authentication, cloud saves, multi-device conflicts and live play.
- Dice polish idea: 2D/3D animated d20/dice result layer driven by deterministic roll result events, not by each client's independent animation RNG.

## First offline DM Room delivered (Draft 32)

- Added `dm.html` with separate DM navigation, mobile-friendly multiple-character JSON import and manual NPC creation.
- Setup roster edits name, HP/max HP, AR, AP max, Death Threshold and initiative total; combat view tracks current actor/round, AP spending, raw-damage-per-hit, healing, HP corrections, and stabilization.
- Data stays in optional `game.encounter`, imported player sheets remain unchanged, and the underlying command engine verifies revisions before every mutation. Sheet Health history logic is reused through `WBCombat`.
- **Next:** improve DM encounter history/export, connect shared battlemap tokens and player movement with validated path/AP, then begin secure cloud authentication, character syncing and real-time sessions. Animated dice can be added to presentation later while the roll result remains separate from the animation.

## Offline shared encounter battlemap (Draft 33)

- DM Room now shows the same bundled Stone Hall, Barrow and blank grid definitions as the character Battlemap, with a scrollable, mobile-friendly five-foot grid and all placed encounter actors (player and NPC) shown as distinct tokens.
- Choose which combatant to place; click a free square to position/reposition, click a token to select, or remove placement. Commands route through `WBEncounter.PlaceToken` / `ClearToken` using map-bound actor positions, revisioned saves, and shared terrain/occupancy validation.
- Map selection writes the normal DM-owned `game.map` value. Encounter token positions remain separate from the character's `game.tokens` movement record and existing `game.foes` until a single authoritative movement/foe reconciliation protocol is designed. Switching maps hides tokens assigned to other maps rather than teleporting them.
- **Next:** introduce actor movement path/AP validation, connect encounter actors to the player-facing battlemap safely, and support game history/export before authenticated sessions and cloud sync. DM manual placement intentionally costs no AP. Fog/lighting, multiplayer permissions, and real-time sync are not yet integrated.

## Encounter movement (Draft 34)

- Active DM encounters can now move a selected **current actor** along a calculated route by spending AP and Surge, respecting walls, occupied squares, difficult terrain and diagonal corners. The UI previews feet and cost and requires confirmation. Free DM placement stays separate.
- Imported PC snapshots include effective Movement and Surge from AGL; NPC movement can be edited before combat. New turn restores movement counters. No player sheet, character file, legacy foe record or `game.tokens` data is overwritten.
- **Next:** shared player-facing encounter movement with robust authoritative state/sync; then initiative/encounter action log and export, server authentication and multiplayer/cloud saves. Animated dice UI can be layered on top of verified roll events afterward.
