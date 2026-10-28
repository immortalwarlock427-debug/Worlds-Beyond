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
